-- =============================================================================
-- PHASE 4: customers & job sites
-- =============================================================================
-- - Customer categories (editable per company)
-- - Customer address fields renamed (billing* → plain address); the fixed
--   residential/commercial type is replaced by categories
-- - Job site fields: reference number, new address for moves, access code,
--   placement instructions, site contact
-- - New container status: IN_STORAGE (rented and full, stored at a yard)
-- Columns are RENAMED rather than dropped, so no data is ever lost.
-- =============================================================================

-- New container status
ALTER TYPE "ContainerStatus" ADD VALUE IF NOT EXISTS 'IN_STORAGE' AFTER 'ON_RENT';

-- Customers: keep address data, just rename the columns
ALTER TABLE "customers" RENAME COLUMN "billingAddressLine1" TO "addressLine1";
ALTER TABLE "customers" RENAME COLUMN "billingAddressLine2" TO "addressLine2";
ALTER TABLE "customers" RENAME COLUMN "billingCity"         TO "city";
ALTER TABLE "customers" RENAME COLUMN "billingState"        TO "state";
ALTER TABLE "customers" RENAME COLUMN "billingPostalCode"   TO "postalCode";
ALTER TABLE "customers" RENAME COLUMN "billingCountry"      TO "country";
ALTER TABLE "customers" ADD COLUMN "categoryId" UUID;
ALTER TABLE "customers" DROP COLUMN "type"; -- replaced by categories (no data yet)
DROP TYPE "CustomerType";

-- Job sites (projects)
ALTER TABLE "projects" RENAME COLUMN "accessInstructions" TO "placementInstructions";
ALTER TABLE "projects"
  ADD COLUMN "accessCode"        TEXT,
  ADD COLUMN "customerReference" TEXT,
  ADD COLUMN "newAddressLine1"   TEXT,
  ADD COLUMN "newAddressLine2"   TEXT,
  ADD COLUMN "newCity"           TEXT,
  ADD COLUMN "newPostalCode"     TEXT,
  ADD COLUMN "newState"          TEXT,
  ADD COLUMN "siteContactName"   TEXT,
  ADD COLUMN "siteContactPhone"  TEXT;

-- Customer categories
CREATE TABLE "customer_categories" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "archivedAt" TIMESTAMPTZ,
    CONSTRAINT "customer_categories_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_categories_companyId_idx" ON "customer_categories"("companyId");
CREATE UNIQUE INDEX "customer_categories_companyId_name_key" ON "customer_categories"("companyId", "name");
ALTER TABLE "customer_categories" ADD CONSTRAINT "customer_categories_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "customer_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Security: same company walls as every other business table (see docs/SECURITY.md)
ALTER TABLE "customer_categories" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "customer_categories" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON "customer_categories" TO app_user;
CREATE POLICY company_isolation ON "customer_categories"
  FOR ALL TO app_user
  USING      ("companyId" = ANY ((SELECT app.accessible_company_ids())::uuid[]))
  WITH CHECK ("companyId" = ANY ((SELECT app.accessible_company_ids())::uuid[]));
