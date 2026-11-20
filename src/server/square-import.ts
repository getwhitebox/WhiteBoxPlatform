// =============================================================================
// Import customers from a Square "Export customers" CSV file.
// The file is read in the browser; rows are checked and imported here.
// Nothing is changed in Square.
// =============================================================================
import "server-only";
import { withUser, type Db } from "@/lib/db";
import type { Session } from "@/lib/session";
import { customerDisplayName, formatPhone, phoneDigits } from "@/lib/format";
import { audit } from "@/server/audit";
import { canEditCustomers, requirePermission } from "@/server/permissions";

export const MAX_IMPORT_ROWS = 2000;

export type ImportRow = {
  squareId: string | null;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  notes: string | null;
};

export type RowResult = {
  row: number; // line number in the file (header = 1)
  name: string;
  detail: string;
  outcome: "new" | "already-imported" | "possible-duplicate" | "skipped";
  reason?: string;
};

// Square's column names, matched loosely (case, spaces and symbols ignored).
const COLUMNS: Record<keyof ImportRow, string[]> = {
  squareId: ["squarecustomerid", "customerid", "id"],
  firstName: ["firstname", "givenname"],
  lastName: ["lastname", "surname", "familyname"],
  businessName: ["companyname", "company", "businessname"],
  email: ["emailaddress", "email"],
  phone: ["phonenumber", "phone", "mobilephone"],
  addressLine1: ["streetaddress1", "addressline1", "address1", "streetaddress", "address"],
  addressLine2: ["streetaddress2", "addressline2", "address2"],
  city: ["city", "locality"],
  state: ["state", "province", "region", "administrativedistrictlevel1"],
  postalCode: ["postalcode", "zipcode", "zip"],
  notes: ["memo", "note", "notes"],
};

const normalize = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Which of Square's columns were recognized (shown to the user). */
export function recognizedColumns(headers: string[]) {
  const norm = headers.map(normalize);
  return Object.fromEntries(
    (Object.keys(COLUMNS) as (keyof ImportRow)[]).map((field) => {
      const i = norm.findIndex((h) => COLUMNS[field].includes(h));
      return [field, i >= 0 ? headers[i] : null];
    }),
  ) as Record<keyof ImportRow, string | null>;
}

export function mapRow(raw: Record<string, unknown>): ImportRow {
  const byNorm = new Map(Object.entries(raw).map(([k, v]) => [normalize(k), String(v ?? "").trim()]));
  const get = (field: keyof ImportRow) => {
    for (const alias of COLUMNS[field]) {
      const v = byNorm.get(alias);
      if (v) return v.slice(0, 500);
    }
    return null;
  };
  return {
    squareId: get("squareId"),
    firstName: get("firstName"),
    lastName: get("lastName"),
    businessName: get("businessName"),
    email: get("email")?.toLowerCase() ?? null,
    phone: get("phone"),
    addressLine1: get("addressLine1"),
    addressLine2: get("addressLine2"),
    city: get("city"),
    state: get("state"),
    postalCode: get("postalCode"),
    notes: get("notes"),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Decide what would happen to each row, without saving anything. */
async function classify(db: Db, session: Session, rows: ImportRow[]): Promise<RowResult[]> {
  // One after the other: queries inside a transaction share one connection.
  const existing = await db.customer.findMany({
    where: { companyId: session.company.id },
    select: { email: true, phone: true, displayName: true },
  });
  const links = await db.externalLink.findMany({
    where: { companyId: session.company.id, provider: "SQUARE", entityType: "Customer" },
    select: { externalId: true },
  });
  const linkedSquareIds = new Set(links.map((l) => l.externalId));
  const emails = new Map(existing.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.displayName]));
  const phones = new Map(
    existing.filter((c) => phoneDigits(c.phone).length >= 7).map((c) => [phoneDigits(c.phone).slice(-10), c.displayName]),
  );

  const seenInFile = new Set<string>();
  return rows.map((r, i) => {
    const name = customerDisplayName(r);
    const digits = phoneDigits(r.phone).slice(-10);
    const detail = [r.phone && formatPhone(r.phone), r.email, r.city].filter(Boolean).join(" · ");
    const base = { row: i + 2, name, detail };

    if (!r.firstName && !r.lastName && !r.businessName) {
      return { ...base, name: r.email ?? "(no name)", outcome: "skipped", reason: "No name or business name" };
    }
    if (r.email && !EMAIL_RE.test(r.email)) {
      return { ...base, outcome: "skipped", reason: `Email "${r.email}" doesn't look valid` };
    }
    if (r.squareId && linkedSquareIds.has(r.squareId)) {
      return { ...base, outcome: "already-imported", reason: "Imported before (same Square ID)" };
    }
    if (r.email && emails.has(r.email)) {
      return { ...base, outcome: "possible-duplicate", reason: `Same email as existing customer "${emails.get(r.email)}"` };
    }
    if (digits.length >= 7 && phones.has(digits)) {
      return { ...base, outcome: "possible-duplicate", reason: `Same phone as existing customer "${phones.get(digits)}"` };
    }
    const keys = [r.squareId && `id:${r.squareId}`, r.email && `e:${r.email}`, digits.length >= 7 && `p:${digits}`].filter(
      Boolean,
    ) as string[];
    if (keys.some((k) => seenInFile.has(k))) {
      return { ...base, outcome: "possible-duplicate", reason: "Appears more than once in this file" };
    }
    keys.forEach((k) => seenInFile.add(k));
    return { ...base, outcome: "new" };
  });
}

export async function previewImport(session: Session, rows: ImportRow[]) {
  requirePermission(canEditCustomers(session));
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`Files are limited to ${MAX_IMPORT_ROWS} customers.`);
  return withUser(session.userId, (db) => classify(db, session, rows));
}

/**
 * Imports only rows classified as "new". Re-checks everything at import time,
 * so a preview can't be replayed to create duplicates.
 */
export async function runImport(session: Session, rows: ImportRow[], categoryId: string | null) {
  requirePermission(canEditCustomers(session));
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`Files are limited to ${MAX_IMPORT_ROWS} customers.`);

  return withUser(session.userId, async (db) => {
    if (categoryId) {
      const ok = await db.customerCategory.count({ where: { id: categoryId, companyId: session.company.id } });
      if (!ok) throw new Error("That category doesn't belong to this company.");
    }
    const results = await classify(db, session, rows);
    const toCreate = results
      .map((result, i) => ({ result, r: rows[i], id: crypto.randomUUID() }))
      .filter(({ result }) => result.outcome === "new");

    // Two bulk inserts (fast even for hundreds of customers).
    await db.customer.createMany({
      data: toCreate.map(({ r, id }) => ({
        id,
        companyId: session.company.id,
        categoryId,
        displayName: customerDisplayName(r),
        firstName: r.firstName,
        lastName: r.lastName,
        businessName: r.businessName,
        email: r.email,
        phone: r.phone ? formatPhone(r.phone) : null,
        addressLine1: r.addressLine1,
        addressLine2: r.addressLine2,
        city: r.city,
        state: r.state,
        postalCode: r.postalCode,
        notes: r.notes,
      })),
    });
    await db.externalLink.createMany({
      data: toCreate
        .filter(({ r }) => r.squareId)
        .map(({ r, id }) => ({
          companyId: session.company.id,
          provider: "SQUARE" as const,
          entityType: "Customer",
          entityId: id,
          externalId: r.squareId!,
          lastSyncedAt: new Date(),
        })),
    });
    const created = toCreate.length;

    const summary = {
      created,
      alreadyImported: results.filter((r) => r.outcome === "already-imported").length,
      possibleDuplicates: results.filter((r) => r.outcome === "possible-duplicate").length,
      skipped: results.filter((r) => r.outcome === "skipped").length,
    };
    await audit(db, session, { action: "import", entityType: "Customer", after: { source: "Square CSV", ...summary } });
    return summary;
  });
}
