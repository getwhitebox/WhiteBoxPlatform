// =============================================================================
// Customers: reading and changing customer records.
// Every function runs as the logged-in person (withUser), so the database's
// company walls always apply. Changes also check permissions and are audited.
// =============================================================================
import "server-only";
import { z } from "zod";
import { withUser, type Db } from "@/lib/db";
import type { Session } from "@/lib/session";
import { customerDisplayName, formatPhone, phoneDigits } from "@/lib/format";
import { audit } from "@/server/audit";
import { optionalEmail, optionalText, optionalUuid } from "@/server/forms";
import { canEditCustomers, requirePermission } from "@/server/permissions";
import type { Prisma } from "@/generated/prisma/client";

/** Active rentals = boxes reserved for, or currently with, the customer. */
export const OPEN_RENTAL_STATUSES = ["RESERVED", "ACTIVE"] as const;

// ------------------------------------------------------------------ input ---

export const customerSchema = z
  .object({
    firstName: optionalText(100),
    lastName: optionalText(100),
    businessName: optionalText(200),
    categoryId: optionalUuid,
    phone: optionalText(40),
    email: optionalEmail,
    addressLine1: optionalText(200),
    addressLine2: optionalText(200),
    city: optionalText(100),
    state: optionalText(50),
    postalCode: optionalText(20),
    notes: optionalText(5000),
  })
  .refine((c) => c.firstName || c.lastName || c.businessName, {
    message: "Enter a first or last name, or a business name.",
    path: ["firstName"],
  });

export type CustomerInput = z.infer<typeof customerSchema>;

function toData(input: CustomerInput) {
  return {
    ...input,
    phone: input.phone ? formatPhone(input.phone) : null,
    displayName: customerDisplayName(input),
  };
}

/** Make sure a category belongs to the same company as the customer. */
async function checkCategory(db: Db, companyId: string, categoryId: string | null) {
  if (!categoryId) return;
  const ok = await db.customerCategory.count({
    where: { id: categoryId, companyId, archivedAt: null },
  });
  if (!ok) throw new Error("That category doesn't belong to this company.");
}

// ------------------------------------------------------------------ reads ---

export async function listCategories(session: Session) {
  return withUser(session.userId, (db) =>
    db.customerCategory.findMany({
      where: { companyId: session.company.id, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  );
}

export async function listCustomers(
  session: Session,
  filters: { q?: string; categoryId?: string; showArchived?: boolean },
) {
  const q = filters.q?.trim();
  const digits = q ? phoneDigits(q) : "";

  const where: Prisma.CustomerWhereInput = {
    companyId: session.company.id,
    archivedAt: filters.showArchived ? { not: null } : null,
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(q
      ? {
          OR: [
            { displayName: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { businessName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { addressLine1: { contains: q, mode: "insensitive" } },
            ...(digits.length >= 3 ? [{ phone: { contains: digits.slice(-4) } }] : []),
          ],
        }
      : {}),
  };

  return withUser(session.userId, async (db) => {
    const customers = await db.customer.findMany({
      where,
      orderBy: { displayName: "asc" },
      take: 300,
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        businessName: true,
        phone: true,
        email: true,
        city: true,
        category: { select: { name: true } },
        projects: {
          where: { archivedAt: null },
          select: {
            status: true,
            _count: { select: { rentals: { where: { status: { in: [...OPEN_RENTAL_STATUSES] } } } } },
          },
        },
      },
    });

    // Phone search: compare digits only, so "435-555-0123" matches "(435) 555-0123".
    const filtered =
      q && digits.length >= 3
        ? customers.filter(
            (c) =>
              phoneDigits(c.phone).includes(digits) ||
              [c.displayName, c.firstName, c.lastName, c.businessName, c.email]
                .filter(Boolean)
                .some((v) => v!.toLowerCase().includes(q.toLowerCase())),
          )
        : customers;

    return filtered.map((c) => ({
      ...c,
      activeSites: c.projects.filter((p) => p.status === "ACTIVE" || p.status === "QUOTE").length,
      boxesOut: c.projects.reduce((n, p) => n + p._count.rentals, 0),
    }));
  });
}

export async function getCustomer(session: Session, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return withUser(session.userId, async (db) => {
    const customer = await db.customer.findFirst({
      where: { id, companyId: session.company.id },
      include: {
        category: { select: { id: true, name: true } },
        contacts: { where: { archivedAt: null }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
        projects: {
          where: { archivedAt: null },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          include: {
            rentals: {
              where: { status: { in: [...OPEN_RENTAL_STATUSES] } },
              select: { id: true, container: { select: { unitNumber: true } } },
            },
          },
        },
      },
    });
    if (!customer) return null;

    const notes = await db.activityNote.findMany({
      where: { companyId: session.company.id, subjectType: "CUSTOMER", subjectId: id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { author: { select: { fullName: true, email: true } } },
    });

    return { customer, notes };
  });
}

// ---------------------------------------------------------------- changes ---

export async function createCustomer(session: Session, input: CustomerInput) {
  requirePermission(canEditCustomers(session));
  return withUser(session.userId, async (db) => {
    await checkCategory(db, session.company.id, input.categoryId);
    const customer = await db.customer.create({
      data: { ...toData(input), companyId: session.company.id },
    });
    await audit(db, session, { action: "create", entityType: "Customer", entityId: customer.id, after: customer });
    return customer;
  });
}

export async function updateCustomer(session: Session, id: string, input: CustomerInput) {
  requirePermission(canEditCustomers(session));
  return withUser(session.userId, async (db) => {
    const before = await db.customer.findFirst({ where: { id, companyId: session.company.id } });
    if (!before) throw new Error("Customer not found.");
    await checkCategory(db, session.company.id, input.categoryId);
    const after = await db.customer.update({ where: { id }, data: toData(input) });
    await audit(db, session, { action: "update", entityType: "Customer", entityId: id, before, after });
    return after;
  });
}

export async function setCustomerArchived(session: Session, id: string, archived: boolean) {
  requirePermission(canEditCustomers(session));
  return withUser(session.userId, async (db) => {
    const before = await db.customer.findFirst({ where: { id, companyId: session.company.id } });
    if (!before) throw new Error("Customer not found.");
    if (archived) {
      const open = await db.rental.count({
        where: { project: { customerId: id }, status: { in: [...OPEN_RENTAL_STATUSES] } },
      });
      if (open > 0) throw new Error("This customer still has boxes out. End those rentals first.");
    }
    const after = await db.customer.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });
    await audit(db, session, {
      action: archived ? "archive" : "restore",
      entityType: "Customer",
      entityId: id,
      before: { archivedAt: before.archivedAt },
      after: { archivedAt: after.archivedAt },
    });
  });
}
