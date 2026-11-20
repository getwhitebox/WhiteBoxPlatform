// =============================================================================
// Who may do what (on top of the database's company walls).
// =============================================================================
import "server-only";
import type { Role } from "@/generated/prisma/client";
import type { Session } from "@/lib/session";

const OFFICE_ROLES: Role[] = ["ORG_OWNER", "ORG_ADMIN", "COMPANY_ADMIN", "OFFICE_STAFF"];
const ADMIN_ROLES: Role[] = ["ORG_OWNER", "ORG_ADMIN", "COMPANY_ADMIN"];

/** Can add and edit customers, job sites, contacts and notes. */
export function canEditCustomers(session: Session): boolean {
  return session.isPlatformAdmin || session.roles.some((r) => OFFICE_ROLES.includes(r));
}

/** Can change company settings such as customer categories. */
export function canManageSettings(session: Session): boolean {
  return session.isPlatformAdmin || session.roles.some((r) => ADMIN_ROLES.includes(r));
}

export class PermissionError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}

export function requirePermission(allowed: boolean) {
  if (!allowed) throw new PermissionError();
}
