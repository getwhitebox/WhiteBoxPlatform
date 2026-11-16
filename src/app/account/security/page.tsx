// Two-factor setup: scan a QR code with an authenticator app, then confirm
// with a 6-digit code.
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import { AuthCard } from "@/components/auth-card";
import { CodeForm } from "@/components/code-form";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const { required } = await searchParams;
  const supabase = await createSupabaseServer();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");

  if (verified) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") redirect("/mfa");

    return (
      <AuthCard title="Two-factor login is on" subtitle="Your account is protected">
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-300">
          Each time you sign in, you&apos;ll enter a code from your authenticator app after your
          password. If you lose your phone, ask a platform administrator to reset your two-factor
          login.
        </p>
        <Link href="/" className="block text-center text-sm text-zinc-600 underline dark:text-zinc-400">
          Back to the dashboard
        </Link>
      </AuthCard>
    );
  }

  // Remove any half-finished setups before starting a new one.
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }

  const { data: enrollment, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator app ${new Date().toISOString().slice(0, 16)}`,
  });

  if (error || !enrollment) {
    return (
      <AuthCard title="Set up two-factor login">
        <p className="text-sm text-red-700 dark:text-red-300">
          Two-factor setup couldn&apos;t start: {error?.message ?? "unknown error"}. Please try
          again in a minute.
        </p>
      </AuthCard>
    );
  }

  const qr = enrollment.totp.qr_code.startsWith("data:")
    ? enrollment.totp.qr_code
    : `data:image/svg+xml;utf-8,${encodeURIComponent(enrollment.totp.qr_code)}`;

  return (
    <AuthCard title="Set up two-factor login" subtitle="Takes about a minute">
      {required && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Administrator accounts must use two-factor login. Please set it up to continue.
        </p>
      )}
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
        <li>Open your authenticator app and tap <strong>+</strong> / Add account.</li>
        <li>Scan this QR code.</li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      <div className="mb-4 flex justify-center rounded-xl bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR code for your authenticator app" width={180} height={180} />
      </div>
      <details className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        <summary className="cursor-pointer">Can&apos;t scan? Enter this key instead</summary>
        <code className="mt-2 block break-all rounded-lg bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-800">
          {enrollment.totp.secret}
        </code>
      </details>
      <CodeForm factorId={enrollment.id} buttonLabel="Turn on two-factor login" />
      <form action={signOut} className="mt-4 text-center">
        <button type="submit" className="text-sm text-zinc-500 underline dark:text-zinc-400">
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}
