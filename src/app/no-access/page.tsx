import { signOut } from "@/app/auth-actions";
import { AuthCard, buttonClass } from "@/components/auth-card";

export default function NoAccessPage() {
  return (
    <AuthCard title="No company access yet" subtitle="White Box Platform">
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-300">
        You&apos;re signed in, but your account hasn&apos;t been added to a company. Ask an
        administrator to give you access, then sign in again.
      </p>
      <form action={signOut}>
        <button type="submit" className={buttonClass}>
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}
