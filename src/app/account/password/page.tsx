"use client";
import { useActionState } from "react";
import { updatePassword, type FormState } from "@/app/auth-actions";
import { AuthCard, buttonClass, FormMessage, inputClass } from "@/components/auth-card";

export default function SetPasswordPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, {});

  return (
    <AuthCard title="Set a new password" subtitle="At least 12 characters">
      <form action={action} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="confirm" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Confirm new password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            className={inputClass}
          />
        </div>
        <FormMessage error={state.error} />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save password"}
        </button>
      </form>
    </AuthCard>
  );
}
