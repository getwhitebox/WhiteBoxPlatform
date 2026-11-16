// =============================================================================
// Who is logged in, and which company they are working in.
// Every page calls requireSession() first.
// =============================================================================
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { withUser } from "@/lib/db";
import type { Role } from "@/generated/prisma/client";

export const COMPANY_COOKIE = "wb_company";

export type CompanySummary = {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  brandName: string;
};

export type Session = {
  userId: string;
  email: string;
  fullName: string | null;
  isPlatformAdmin: boolean;
  /** Every company this person may access. */
  companies: CompanySummary[];
  /** The company they are currently working in. */
  company: CompanySummary;
  /** Their roles in the current company (org-wide roles included). */
  roles: Role[];
};

/**
 * Returns the logged-in person and their current company, or sends them to
 * the login page. Cached for the duration of one request.
 */
export const requireSession = cache(async (): Promise<Session> => {
  const supabase = await createSupabaseServer();
  // getUser() asks Supabase to confirm the login is still valid.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  const authUser = data.user;

  const chosenCompanyId = (await cookies()).get(COMPANY_COOKIE)?.value;

  const result = await withUser(authUser.id, async (db) => {
    const user = await db.user.findUnique({ where: { id: authUser.id } });
    if (!user || user.archivedAt) return null;

    // The database only returns companies this person may access.
    const companies = await db.company.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      include: {
        organization: { select: { name: true } },
        brands: { where: { isDefault: true, archivedAt: null }, take: 1 },
      },
    });

    const memberships = await db.membership.findMany({
      where: { userId: user.id, archivedAt: null },
    });

    return { user, companies, memberships };
  });

  if (!result) redirect("/login?error=no-account");
  const { user, companies, memberships } = result;

  if (companies.length === 0) redirect("/no-access");

  const summaries: CompanySummary[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    organizationId: c.organizationId,
    organizationName: c.organization.name,
    brandName: c.brands[0]?.name ?? c.name,
  }));

  const company = summaries.find((c) => c.id === chosenCompanyId) ?? summaries[0];

  const roles = user.isPlatformAdmin
    ? (["ORG_OWNER"] as Role[])
    : memberships
        .filter(
          (m) =>
            m.companyId === company.id ||
            (m.companyId === null && m.organizationId === company.organizationId),
        )
        .map((m) => m.role);

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    isPlatformAdmin: user.isPlatformAdmin,
    companies: summaries,
    company,
    roles,
  };
});
