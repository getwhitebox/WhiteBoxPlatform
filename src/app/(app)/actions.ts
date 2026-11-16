"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COMPANY_COOKIE, requireSession } from "@/lib/session";

/** Switch the company you're working in (central admins with several companies). */
export async function switchCompany(formData: FormData) {
  const session = await requireSession();
  const companyId = String(formData.get("companyId") ?? "");

  // Only companies this person can access are accepted.
  if (!session.companies.some((c) => c.id === companyId)) redirect("/");

  (await cookies()).set(COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/");
}
