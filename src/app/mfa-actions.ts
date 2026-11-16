"use server";
// =============================================================================
// Two-factor login (authenticator app codes). Server only.
// =============================================================================
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export type CodeState = { error?: string };

/**
 * Checks a 6-digit code from the authenticator app. Used both to finish
 * setting up two-factor and to sign in with it. On success the login is
 * upgraded to "two-factor verified".
 */
export async function verifyCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from your authenticator app." };

  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    return {
      error:
        "That code didn't work. Codes change every 30 seconds, so use the current one. Also check your phone's clock is set automatically.",
    };
  }

  redirect("/");
}
