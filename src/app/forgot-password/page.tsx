"use client";
import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/app/auth-actions";
import { AuthCard, buttonClass, FormMessage, inputClass } from "@/components/auth-card";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});

  return (
    <AuthCard title="Reset password" subtitle="We'll email you a reset link">
      <form action={action} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </div>
        <FormMessage error={state.error} message={state.message} />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
        <p className="text-center text-sm">
          <Link href="/login" className="text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
