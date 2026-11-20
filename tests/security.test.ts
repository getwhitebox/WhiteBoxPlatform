// =============================================================================
// SECURITY TESTS – prove the database rules actually protect the data.
// Run with:  npm run test:security
//
// Runs against the DEVELOPMENT database (DATABASE_URL in .env).
// Every test runs inside a transaction that is rolled back at the end, so the
// test companies and users it creates are never saved.
// =============================================================================
import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { Client } from "pg";

const db = new Client({ connectionString: process.env.DATABASE_URL });

before(async () => {
  await db.connect();
});
after(async () => {
  await db.end();
});

// ---------------------------------------------------------------- helpers ---

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows as T[];
}

/** Run a test inside a transaction that is always rolled back. */
async function inRollback(fn: () => Promise<void>) {
  await db.query("BEGIN");
  try {
    await fn();
  } finally {
    await db.query("ROLLBACK");
  }
}

/** Act as a logged-in app user (restricted role + user id). */
async function actAs(userId: string | null) {
  await db.query("SET LOCAL ROLE app_user");
  await db.query("SELECT set_config('app.user_id', $1, true)", [userId ?? ""]);
}

/** Go back to the database owner (used for setting up test data). */
async function actAsOwner() {
  await db.query("RESET ROLE");
  await db.query("SELECT set_config('app.user_id', '', true)");
}

/** Assert that a statement is refused by the database. */
async function expectRefused(sql: string, params: unknown[] = [], pattern?: RegExp) {
  await db.query("SAVEPOINT attempt");
  let error: Error | undefined;
  try {
    await db.query(sql, params);
  } catch (e) {
    error = e as Error;
  }
  await db.query("ROLLBACK TO SAVEPOINT attempt");
  assert.ok(error, `Expected the database to refuse:\n  ${sql}`);
  if (pattern) assert.match(error.message, pattern);
}

async function count(sql: string, params: unknown[] = []) {
  const [row] = await q<{ n: string }>(sql, params);
  return Number(row.n);
}

// ------------------------------------------------------------ test world ---
// Builds (inside the rolled-back transaction):
//   Org A = the real "White Box" org
//     Company A  = White Box Mobile Storage (40 real WB containers)
//     Company A2 = "Acquired Co" (1 container AC001)
//   Org B = "Other Storage Org" (a licensee)
//     Company B  = "Other Storage Co" (1 container OS001)
// Users: staffA, companyAdminA, orgAdminA, staffB, platformAdmin, outsider

async function buildWorld() {
  await actAsOwner();
  const [orgA] = await q<{ id: string }>(`SELECT id FROM organizations WHERE slug = 'white-box'`);
  const [companyA] = await q<{ id: string }>(
    `SELECT id FROM companies WHERE "organizationId" = $1 AND slug = 'white-box-mobile-storage'`,
    [orgA.id],
  );
  assert.ok(orgA && companyA, "Seed data missing – run: npx prisma db seed");

  const id = async () => (await q<{ id: string }>("SELECT gen_random_uuid() AS id"))[0].id;

  async function makeCompany(orgId: string, name: string, slug: string, prefix: string) {
    const companyId = await id();
    await q(
      `INSERT INTO companies (id, "organizationId", name, slug, "unitPrefix", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, now())`,
      [companyId, orgId, name, slug, prefix],
    );
    const typeId = await id();
    await q(
      `INSERT INTO container_types (id, "companyId", name, "lengthFt", "widthFt", "heightFt", "updatedAt")
       VALUES ($1, $2, '16 ft', 16, 8, 8, now())`,
      [typeId, companyId],
    );
    const containerId = await id();
    await q(
      `INSERT INTO containers (id, "companyId", "unitNumber", "containerTypeId", "updatedAt")
       VALUES ($1, $2, $3, $4, now())`,
      [containerId, companyId, `${prefix}001`, typeId],
    );
    return { companyId, typeId, containerId };
  }

  const a2 = await makeCompany(orgA.id, "Acquired Co", "acquired-co-test", "AC");
  const orgBId = await id();
  await q(
    `INSERT INTO organizations (id, name, slug, "updatedAt") VALUES ($1, 'Other Storage Org', 'other-org-test', now())`,
    [orgBId],
  );
  const b = await makeCompany(orgBId, "Other Storage Co", "other-co-test", "OS");

  async function makeUser(label: string, isPlatformAdmin = false) {
    const userId = await id();
    await q(
      `INSERT INTO users (id, email, "isPlatformAdmin", "updatedAt") VALUES ($1, $2, $3, now())`,
      [userId, `${label}-${userId}@test.invalid`, isPlatformAdmin],
    );
    return userId;
  }
  async function grant(userId: string, orgId: string, companyId: string | null, role: string) {
    await q(
      `INSERT INTO memberships (id, "userId", "organizationId", "companyId", role, "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4::"Role", now())`,
      [userId, orgId, companyId, role],
    );
  }

  const staffA = await makeUser("staffA");
  await grant(staffA, orgA.id, companyA.id, "OFFICE_STAFF");
  const companyAdminA = await makeUser("companyAdminA");
  await grant(companyAdminA, orgA.id, companyA.id, "COMPANY_ADMIN");
  const orgAdminA = await makeUser("orgAdminA");
  await grant(orgAdminA, orgA.id, null, "ORG_ADMIN");
  const staffB = await makeUser("staffB");
  await grant(staffB, orgBId, b.companyId, "OFFICE_STAFF");
  const platformAdmin = await makeUser("platformAdmin", true);
  const outsider = await makeUser("outsider");

  return {
    orgA: orgA.id,
    orgB: orgBId,
    companyA: companyA.id,
    companyA2: a2.companyId,
    companyB: b.companyId,
    containerB: b.containerId,
    containerA2: a2.containerId,
    users: { staffA, companyAdminA, orgAdminA, staffB, platformAdmin, outsider },
  };
}

const visibleContainers = () => count(`SELECT count(*) AS n FROM containers`);
const visibleCompanies = () => count(`SELECT count(*) AS n FROM companies`);

// ================================================================= TESTS ===

describe("1. The back door is closed", () => {
  test("every table has row-level security switched on", async () => {
    const unprotected = await q<{ relname: string }>(`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`);
    assert.deepEqual(unprotected.map((r) => r.relname), [], "Tables without protection");
  });

  test("Supabase public web roles (anon, authenticated) have no access to any table", async () => {
    const leaks = await q<{ grantee: string; table_name: string }>(`
      SELECT grantee, table_name FROM information_schema.role_table_grants
       WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')`);
    assert.deepEqual(leaks, [], "Public roles still have access");
  });

  test("the app role cannot read Prisma's internal migration table", async () => {
    await inRollback(async () => {
      await actAs(null);
      await expectRefused(`SELECT * FROM _prisma_migrations`, [], /permission denied/);
    });
  });
});

describe("2. Company walls", () => {
  test("with no logged-in user, nothing is visible", async () => {
    await inRollback(async () => {
      await buildWorld();
      await actAs(null);
      assert.equal(await visibleContainers(), 0);
      assert.equal(await visibleCompanies(), 0);
    });
  });

  test("a user with no memberships sees nothing", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.outsider);
      assert.equal(await visibleContainers(), 0);
    });
  });

  test("White Box staff see only White Box containers (all 40)", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.staffA);
      const rows = await q<{ companyId: string }>(`SELECT DISTINCT "companyId" FROM containers`);
      assert.deepEqual(rows.map((r) => r.companyId), [w.companyA]);
      assert.equal(await visibleContainers(), 40);
      assert.equal(await visibleCompanies(), 1);
    });
  });

  test("another organization's staff cannot see any White Box data", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.staffB);
      assert.equal(await visibleContainers(), 1);
      assert.equal(
        await count(`SELECT count(*) AS n FROM containers WHERE "companyId" = $1`, [w.companyA]),
        0,
      );
      assert.equal(await count(`SELECT count(*) AS n FROM locations WHERE "companyId" = $1`, [w.companyA]), 0);
    });
  });

  test("an org-wide admin sees every company in their organization – but not other organizations", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.orgAdminA);
      const ids = (await q<{ id: string }>(`SELECT id FROM companies`)).map((r) => r.id).sort();
      assert.deepEqual(ids, [w.companyA, w.companyA2].sort());
      assert.equal(await visibleContainers(), 41); // 40 WB + 1 Acquired Co
    });
  });

  test("a platform admin sees everything", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.platformAdmin);
      const ids = (await q<{ id: string }>(`SELECT id FROM companies`)).map((r) => r.id);
      for (const c of [w.companyA, w.companyA2, w.companyB]) assert.ok(ids.includes(c));
    });
  });

  test("staff cannot create a customer in another company", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.staffA);
      await expectRefused(
        `INSERT INTO customers (id, "companyId", "displayName", "updatedAt")
         VALUES (gen_random_uuid(), $1, 'Sneaky', now())`,
        [w.companyB],
        /row-level security/,
      );
    });
  });

  test("staff can create a customer in their own company", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.staffA);
      const rows = await q(
        `INSERT INTO customers (id, "companyId", "displayName", "updatedAt")
         VALUES (gen_random_uuid(), $1, 'Test Customer', now()) RETURNING id`,
        [w.companyA],
      );
      assert.equal(rows.length, 1);
    });
  });

  test("customer categories are separated by company", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.staffB);
      assert.equal(
        await count(`SELECT count(*) AS n FROM customer_categories WHERE "companyId" = $1`, [w.companyA]),
        0,
      );
      await expectRefused(
        `INSERT INTO customer_categories (id, "companyId", name, "updatedAt")
         VALUES (gen_random_uuid(), $1, 'Sneaky', now())`,
        [w.companyA],
        /row-level security/,
      );
    });
  });

  test("staff cannot change another company's container", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.staffA);
      const changed = await db.query(`UPDATE containers SET notes = 'hacked' WHERE id = $1`, [w.containerB]);
      assert.equal(changed.rowCount, 0);
    });
  });

  test("staff cannot move their own record into another company", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.staffA);
      await expectRefused(
        `UPDATE containers SET "companyId" = $1 WHERE "unitNumber" = 'WB001' AND "companyId" = $2`,
        [w.companyB, w.companyA],
        /row-level security/,
      );
    });
  });
});

describe("3. Nothing is ever deleted", () => {
  test("the app cannot delete records (archive instead)", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.platformAdmin); // even the most powerful app user
      await expectRefused(`DELETE FROM containers WHERE "unitNumber" = 'WB001'`, [], /permission denied/);
      await expectRefused(`DELETE FROM customers`, [], /permission denied/);
    });
  });
});

describe("4. History is permanent", () => {
  test("app users can add container history but not edit or delete it", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.staffA);
      const [ev] = await q<{ id: string }>(
        `INSERT INTO container_events (id, "companyId", "containerId", type, "occurredAt")
         SELECT gen_random_uuid(), "companyId", id, 'NOTE', now() FROM containers
          WHERE "unitNumber" = 'WB001' AND "companyId" = $1
         RETURNING id`,
        [w.companyA],
      );
      assert.ok(ev, "adding history should work");
      await expectRefused(`UPDATE container_events SET notes = 'changed' WHERE id = $1`, [ev.id]);
      await expectRefused(`DELETE FROM container_events WHERE id = $1`, [ev.id]);
    });
  });

  test("even the database owner cannot edit or delete container history", async () => {
    await inRollback(async () => {
      await actAsOwner();
      await expectRefused(`UPDATE container_events SET notes = 'changed'`, [], /permanent history/);
      await expectRefused(`DELETE FROM container_events`, [], /permanent history/);
      await expectRefused(`TRUNCATE container_events`, [], /permanent history/);
    });
  });

  test("even the database owner cannot edit or delete the audit log", async () => {
    await inRollback(async () => {
      await actAsOwner();
      await q(
        `INSERT INTO audit_log (id, action, "entityType") VALUES (gen_random_uuid(), 'test', 'Test')`,
      );
      await expectRefused(`UPDATE audit_log SET action = 'changed'`, [], /permanent history/);
      await expectRefused(`DELETE FROM audit_log`, [], /permanent history/);
    });
  });

  test("users cannot record history in another company", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.staffA);
      await expectRefused(
        `INSERT INTO container_events (id, "companyId", "containerId", type, "occurredAt")
         VALUES (gen_random_uuid(), $1, $2, 'NOTE', now())`,
        [w.companyB, w.containerB],
        /row-level security/,
      );
    });
  });
});

describe("5. Roles and permissions", () => {
  test("nobody can make themselves a platform admin", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.staffA);
      await expectRefused(
        `UPDATE users SET "isPlatformAdmin" = true WHERE id = $1`,
        [w.users.staffA],
        /permission denied/,
      );
    });
  });

  test("users can update their own name", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.staffA);
      const r = await db.query(`UPDATE users SET "fullName" = 'New Name' WHERE id = $1`, [w.users.staffA]);
      assert.equal(r.rowCount, 1);
    });
  });

  test("office staff cannot grant anyone a role", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.staffA);
      await expectRefused(
        `INSERT INTO memberships (id, "userId", "organizationId", "companyId", role, "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'COMPANY_ADMIN', now())`,
        [w.users.staffA, w.orgA, w.companyA],
        /row-level security/,
      );
    });
  });

  test("a company admin can add staff to their own company", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.companyAdminA);
      const r = await db.query(
        `INSERT INTO memberships (id, "userId", "organizationId", "companyId", role, "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'DRIVER', now())`,
        [w.users.outsider, w.orgA, w.companyA],
      );
      assert.equal(r.rowCount, 1);
    });
  });

  test("a company admin cannot grant organization-wide roles", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.companyAdminA);
      await expectRefused(
        `INSERT INTO memberships (id, "userId", "organizationId", "companyId", role, "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, NULL, 'ORG_ADMIN', now())`,
        [w.users.companyAdminA, w.orgA],
        /row-level security/,
      );
      await expectRefused(
        `INSERT INTO memberships (id, "userId", "organizationId", "companyId", role, "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'ORG_OWNER', now())`,
        [w.users.companyAdminA, w.orgA, w.companyA],
        /row-level security/,
      );
    });
  });

  test("a company admin cannot add users to a different company", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.companyAdminA);
      await expectRefused(
        `INSERT INTO memberships (id, "userId", "organizationId", "companyId", role, "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'OFFICE_STAFF', now())`,
        [w.users.outsider, w.orgA, w.companyA2],
        /row-level security/,
      );
    });
  });

  test("only platform admins can create new companies", async () => {
    await inRollback(async () => {
      const w = await buildWorld();
      await actAs(w.users.orgAdminA);
      await expectRefused(
        `INSERT INTO companies (id, "organizationId", name, slug, "unitPrefix", "updatedAt")
         VALUES (gen_random_uuid(), $1, 'New Co', 'new-co', 'NC', now())`,
        [w.orgA],
        /row-level security/,
      );
    });
  });
});
