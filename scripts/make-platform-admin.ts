// =============================================================================
// Make an existing login account a PLATFORM ADMIN and an owner of the
// White Box organization.
//
//   npx tsx scripts/make-platform-admin.ts you@example.com
//
// Uses the database owner connection (DATABASE_URL), so it only works for
// someone who has the database password. Every run is written to the audit log.
// =============================================================================
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npx tsx scripts/make-platform-admin.ts <email>");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user) {
    throw new Error(
      `No login account for ${email}. Create it first in Supabase → Authentication → Users.`,
    );
  }

  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "white-box" } });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { isPlatformAdmin: true } });

    const existing = await tx.membership.findFirst({
      where: { userId: user.id, organizationId: org.id, companyId: null, role: "ORG_OWNER", archivedAt: null },
    });
    if (!existing) {
      await tx.membership.create({
        data: { userId: user.id, organizationId: org.id, companyId: null, role: "ORG_OWNER" },
      });
    }

    await tx.auditLog.create({
      data: {
        organizationId: org.id,
        userId: null,
        action: "grant_platform_admin",
        entityType: "User",
        entityId: user.id,
        after: { email: user.email, isPlatformAdmin: true, role: "ORG_OWNER" },
      },
    });
  });

  console.log(`${user.email} is now a platform admin and owner of "${org.name}".`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
