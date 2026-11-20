// Smoke test for Phase 4 server logic against the DEV database.
// Run: npx tsx --conditions=react-server scripts/smoke-customers.ts
// Creates one clearly-labelled test customer + job site, then archives it.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Session } from "../src/lib/session";
import { createCustomer, customerSchema, getCustomer, listCustomers, setCustomerArchived } from "../src/server/customers";
import { createJobSite, jobSiteSchema, listJobSites } from "../src/server/job-sites";
import { addNote } from "../src/server/contacts-notes";
import { mapRow, previewImport } from "../src/server/square-import";

const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const ok = (label: string, cond: boolean) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) process.exitCode = 1;
};

async function main() {
  const admin = await owner.user.findFirstOrThrow({ where: { isPlatformAdmin: true } });
  const company = await owner.company.findFirstOrThrow({ where: { slug: "white-box-mobile-storage" } });
  const session = {
    userId: admin.id,
    email: admin.email,
    fullName: admin.fullName,
    isPlatformAdmin: true,
    company: { id: company.id, name: company.name, organizationId: company.organizationId, organizationName: "", brandName: "", timeZone: company.timeZone },
    companies: [],
    roles: ["ORG_OWNER"],
  } as unknown as Session;

  // Validation
  ok("rejects a customer with no name", !customerSchema.safeParse({ email: "x@y.com" }).success);
  ok("rejects a bad email", !customerSchema.safeParse({ firstName: "A", email: "nope" }).success);

  const restoration = await owner.customerCategory.findFirstOrThrow({ where: { companyId: company.id, name: "Restoration contractor" } });
  const input = customerSchema.parse({
    firstName: "Test",
    lastName: "Smoke",
    businessName: "TEST – Smoke Test Restoration",
    categoryId: restoration.id,
    phone: "4355550199",
    email: "smoke-test@example.test",
    addressLine1: "1 Test St",
    city: "St George",
    state: "UT",
  });
  const customer = await createCustomer(session, input);
  ok("creates customer with display name from business", customer.displayName === "TEST – Smoke Test Restoration");
  ok("formats phone", customer.phone === "(435) 555-0199");

  const found = await listCustomers(session, { q: "435-555-0199" });
  ok("finds customer by phone typed differently", found.some((c) => c.id === customer.id));
  const byCategory = await listCustomers(session, { categoryId: restoration.id });
  ok("filters by category", byCategory.some((c) => c.id === customer.id));

  const site = await createJobSite(session, customer.id, jobSiteSchema.parse({
    name: "1 Test St – smoke test",
    status: "ACTIVE",
    siteAddressLine1: "1 Test St",
    newAddressLine1: "2 New Home Rd",
    accessCode: "1234",
    customerReference: "CLAIM-42",
  }));
  ok("creates job site", Boolean(site.id));
  const sites = await listJobSites(session, { q: "CLAIM-42" });
  ok("finds job site by reference", sites.some((s) => s.id === site.id));

  await addNote(session, { type: "CUSTOMER", id: customer.id }, "Smoke test note");
  const detail = await getCustomer(session, customer.id);
  ok("customer page shows job site and note", detail?.customer.projects.length === 1 && detail.notes.length === 1);

  // Import preview (nothing saved)
  const preview = await previewImport(session, [
    { "First Name": "Ann", "Last Name": "New", "Email Address": "ann.new@example.test", "Square Customer ID": "SQ1" },
    { "First Name": "Dup", "Phone Number": "435-555-0199" },
    { "Email Address": "noname@example.test" },
    { "First Name": "Ann", "Last Name": "Again", "Email Address": "ann.new@example.test" },
  ].map(mapRow));
  ok("import: new row recognized", preview[0].outcome === "new");
  ok("import: phone duplicate detected", preview[1].outcome === "possible-duplicate");
  ok("import: row without name skipped", preview[2].outcome === "skipped");
  ok("import: duplicate within file detected", preview[3].outcome === "possible-duplicate");

  // Archive is blocked only when boxes are out; none here, so it works.
  await setCustomerArchived(session, customer.id, true);
  const archived = await owner.customer.findUniqueOrThrow({ where: { id: customer.id } });
  ok("archives test customer (kept, hidden)", archived.archivedAt !== null);
  const audits = await owner.auditLog.count({ where: { entityId: { in: [customer.id, site.id] } } });
  ok("changes recorded in audit log", audits >= 3);
}

main()
  .catch((e) => {
    console.error("ERROR", e);
    process.exitCode = 1;
  })
  .finally(() => owner.$disconnect());
