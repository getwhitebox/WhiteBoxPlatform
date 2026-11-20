// =============================================================================
// Job sites (stored as "projects"): each customer can have many.
// =============================================================================
import "server-only";
import { z } from "zod";
import { withUser } from "@/lib/db";
import type { Session } from "@/lib/session";
import { formatPhone } from "@/lib/format";
import { audit } from "@/server/audit";
import { optionalDate, optionalText, requiredText } from "@/server/forms";
import { OPEN_RENTAL_STATUSES } from "@/server/customers";
import { canEditCustomers, requirePermission } from "@/server/permissions";
import type { Prisma, ProjectStatus } from "@/generated/prisma/client";

export const JOB_SITE_STATUS_LABELS: Record<ProjectStatus, string> = {
  QUOTE: "Quote",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const jobSiteSchema = z.object({
  name: requiredText("Job site name"),
  status: z.enum(["QUOTE", "ACTIVE", "COMPLETED", "CANCELLED"]),
  customerReference: optionalText(100),
  siteAddressLine1: optionalText(200),
  siteAddressLine2: optionalText(200),
  siteCity: optionalText(100),
  siteState: optionalText(50),
  sitePostalCode: optionalText(20),
  newAddressLine1: optionalText(200),
  newAddressLine2: optionalText(200),
  newCity: optionalText(100),
  newState: optionalText(50),
  newPostalCode: optionalText(20),
  accessCode: optionalText(100),
  placementInstructions: optionalText(2000),
  siteContactName: optionalText(150),
  siteContactPhone: optionalText(40),
  startDate: optionalDate,
  endDate: optionalDate,
  notes: optionalText(5000),
});

export type JobSiteInput = z.infer<typeof jobSiteSchema>;

function toData(input: JobSiteInput) {
  return {
    ...input,
    siteContactPhone: input.siteContactPhone ? formatPhone(input.siteContactPhone) : null,
  };
}

export async function listJobSites(
  session: Session,
  filters: { q?: string; status?: ProjectStatus | "OPEN" },
) {
  const q = filters.q?.trim();
  const statusFilter: Prisma.ProjectWhereInput =
    filters.status === "OPEN" || !filters.status
      ? { status: { in: ["QUOTE", "ACTIVE"] } }
      : { status: filters.status };

  return withUser(session.userId, (db) =>
    db.project.findMany({
      where: {
        companyId: session.company.id,
        archivedAt: null,
        ...statusFilter,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { siteAddressLine1: { contains: q, mode: "insensitive" } },
                { siteCity: { contains: q, mode: "insensitive" } },
                { customerReference: { contains: q, mode: "insensitive" } },
                { customer: { displayName: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 300,
      select: {
        id: true,
        name: true,
        status: true,
        siteAddressLine1: true,
        siteCity: true,
        customerReference: true,
        newAddressLine1: true,
        customer: { select: { id: true, displayName: true } },
        _count: { select: { rentals: { where: { status: { in: [...OPEN_RENTAL_STATUSES] } } } } },
      },
    }),
  );
}

export async function getJobSite(session: Session, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return withUser(session.userId, async (db) => {
    const site = await db.project.findFirst({
      where: { id, companyId: session.company.id },
      include: {
        customer: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            email: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            postalCode: true,
          },
        },
        rentals: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            container: { select: { id: true, unitNumber: true, status: true } },
          },
        },
      },
    });
    if (!site) return null;

    const notes = await db.activityNote.findMany({
      where: { companyId: session.company.id, subjectType: "PROJECT", subjectId: id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { author: { select: { fullName: true, email: true } } },
    });
    return { site, notes };
  });
}

/** Customer's address, used to pre-fill a new job site. */
export async function getCustomerForNewSite(session: Session, customerId: string) {
  if (!z.uuid().safeParse(customerId).success) return null;
  return withUser(session.userId, (db) =>
    db.customer.findFirst({
      where: { id: customerId, companyId: session.company.id, archivedAt: null },
      select: {
        id: true,
        displayName: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
      },
    }),
  );
}

export async function createJobSite(session: Session, customerId: string, input: JobSiteInput) {
  requirePermission(canEditCustomers(session));
  return withUser(session.userId, async (db) => {
    // The customer must exist in the current company (no cross-company links).
    const customer = await db.customer.findFirst({
      where: { id: customerId, companyId: session.company.id, archivedAt: null },
      select: { id: true },
    });
    if (!customer) throw new Error("Customer not found.");

    const site = await db.project.create({
      data: { ...toData(input), customerId, companyId: session.company.id },
    });
    await audit(db, session, { action: "create", entityType: "JobSite", entityId: site.id, after: site });
    return site;
  });
}

export async function updateJobSite(session: Session, id: string, input: JobSiteInput) {
  requirePermission(canEditCustomers(session));
  return withUser(session.userId, async (db) => {
    const before = await db.project.findFirst({ where: { id, companyId: session.company.id } });
    if (!before) throw new Error("Job site not found.");
    const after = await db.project.update({ where: { id }, data: toData(input) });
    await audit(db, session, { action: "update", entityType: "JobSite", entityId: id, before, after });
    return after;
  });
}
