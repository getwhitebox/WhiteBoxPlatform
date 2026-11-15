// =============================================================================
// Starting data for the DEVELOPMENT database.
// Run with:  npx prisma db seed
//
// Safe to run more than once: it only adds what is missing and never
// duplicates or deletes anything.
// =============================================================================
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CONTAINER_COUNT = 40; // WB001 – WB040

async function main() {
  // 1. Organization (parent group). Rename any time.
  const org = await prisma.organization.upsert({
    where: { slug: "white-box" },
    update: {},
    create: { name: "White Box", slug: "white-box" },
  });

  // 2. Operating company
  const company = await prisma.company.upsert({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: "white-box-mobile-storage",
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: "White Box Mobile Storage",
      slug: "white-box-mobile-storage",
      unitPrefix: "WB",
      timeZone: "America/Denver", // St George, UT (Mountain Time)
    },
  });

  // 3. Default brand
  const existingBrand = await prisma.brand.findFirst({
    where: { companyId: company.id, isDefault: true },
  });
  if (!existingBrand) {
    await prisma.brand.create({
      data: {
        companyId: company.id,
        name: "White Box Mobile Storage",
        isDefault: true,
      },
    });
  }

  // 4. Yard
  let yard = await prisma.location.findFirst({
    where: { companyId: company.id, name: "St George Yard" },
  });
  if (!yard) {
    yard = await prisma.location.create({
      data: {
        companyId: company.id,
        name: "St George Yard",
        type: "YARD",
        addressLine1: "825 N. Industrial Rd.",
        city: "St George",
        state: "UT",
        postalCode: "84770",
      },
    });
  }

  // 5. Container type: 8' x 8' x 16'
  let containerType = await prisma.containerType.findFirst({
    where: { companyId: company.id, name: "16 ft Standard" },
  });
  if (!containerType) {
    containerType = await prisma.containerType.create({
      data: {
        companyId: company.id,
        name: "16 ft Standard",
        lengthFt: 16,
        widthFt: 8,
        heightFt: 8,
        description: "8' x 8' x 16' portable storage container",
      },
    });
  }

  // 6. Containers WB001 – WB040, each with an "added to fleet" history entry
  let created = 0;
  for (let n = 1; n <= CONTAINER_COUNT; n++) {
    const unitNumber = `${company.unitPrefix}${String(n).padStart(3, "0")}`;
    const exists = await prisma.container.findUnique({
      where: { companyId_unitNumber: { companyId: company.id, unitNumber } },
    });
    if (exists) continue;

    await prisma.$transaction(async (tx) => {
      const container = await tx.container.create({
        data: {
          companyId: company.id,
          unitNumber,
          containerTypeId: containerType.id,
          status: "AVAILABLE",
          condition: "GOOD",
          homeLocationId: yard.id,
          currentLocationId: yard.id,
        },
      });
      await tx.containerEvent.create({
        data: {
          companyId: company.id,
          containerId: container.id,
          type: "ADDED_TO_FLEET",
          occurredAt: new Date(),
          toStatus: "AVAILABLE",
          toLocationId: yard.id,
          notes: "Initial fleet setup",
        },
      });
    });
    created++;
  }

  const total = await prisma.container.count({ where: { companyId: company.id } });
  console.log(`Organization: ${org.name}`);
  console.log(`Company:      ${company.name} (prefix ${company.unitPrefix})`);
  console.log(`Yard:         ${yard.name}`);
  console.log(`Type:         ${containerType.name}`);
  console.log(`Containers:   ${created} added, ${total} total`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
