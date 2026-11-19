// Set a new password. People with two-factor turned on must enter their
// 6-digit code first (Supabase requires it before a password change).
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export default async function SetPasswordPage() {
  const supabase = await createSupabaseServer();

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect("/mfa?next=/account/password");
  }

  return <PasswordForm />;
}
