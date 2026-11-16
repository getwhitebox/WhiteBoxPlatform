"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signIn, type FormState } from "@/app/auth-actions";
import { AuthCard, buttonClass, FormMessage, inputClass } from "@/components/auth-card";

export default function LoginPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});

  return (
    <AuthCard title="Sign in" subtitle="White Box Platform">
      <form action={action} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </div>
        <FormMessage error={state.error} />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
