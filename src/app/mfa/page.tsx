// Second step of signing in: enter the code from the authenticator app.
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import { AuthCard } from "@/components/auth-card";
import { CodeForm } from "@/components/code-form";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function MfaPage() {
  const supabase = await createSupabaseServer();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") redirect("/");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.find((f) => f.status === "verified");
  if (!factor) redirect("/account/security");

  return (
    <AuthCard title="Enter your code" subtitle="From your authenticator app">
      <CodeForm factorId={factor.id} buttonLabel="Continue" />
      <form action={signOut} className="mt-4 text-center">
        <button type="submit" className="text-sm text-zinc-500 underline dark:text-zinc-400">
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}
