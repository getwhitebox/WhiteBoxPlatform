"use server";
// =============================================================================
// Login, logout and password actions. These run on the server only.
// =============================================================================
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string };

function systemProblemMessage(detail: string) {
  if (/invalid api key/i.test(detail)) {
    return "System setup problem: the site's Supabase publishable key doesn't match its Supabase project. This isn't your password. Please contact your administrator.";
  }
  return `System problem (${detail}). This isn't your password. Please contact your administrator.`;
}

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Wrong email or password: same message either way, so the form can't be
    // used to discover which emails have accounts.
    if (error.code === "invalid_credentials" || error.status === 400) {
      return { error: "Incorrect email or password." };
    }
    if (error.status === 429) {
      return { error: "Too many sign-in attempts. Please wait a few minutes and try again." };
    }
    // Anything else is a system problem, not the person's password.
    console.error("Sign-in failed:", error.status, error.code, error.message);
    return { error: systemProblemMessage(error.message) };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/account/password`,
  });

  // Supabase reports success whether or not the email has an account, so an
  // error here is a real problem (e.g. email limit reached) and safe to show.
  if (error) {
    console.error("Password reset email failed:", error.status, error.code, error.message);
    return {
      error:
        error.status === 429
          ? "Too many reset emails were sent recently. Please wait an hour and try again."
          : systemProblemMessage(error.message),
    };
  }

  // Same answer whether or not the email has an account.
  return {
    message:
      "If that email has an account, a reset link is on its way. Open it on this same device and browser.",
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 12) return { error: "Use at least 12 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/");
}
