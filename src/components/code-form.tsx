"use client";
import { useActionState } from "react";
import { verifyCode, type CodeState } from "@/app/mfa-actions";
import { buttonClass, FormMessage, inputClass } from "@/components/auth-card";

/** Form for entering a 6-digit authenticator code. */
export function CodeForm({ factorId, buttonLabel, next = "/" }: {
  factorId: string;
  buttonLabel: string;
  /** Page to go to after a correct code. */
  next?: string;
}) {
  const [state, action, pending] = useActionState<CodeState, FormData>(verifyCode, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1">
        <label htmlFor="code" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          6-digit code
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          autoFocus
          className={`${inputClass} text-center text-2xl tracking-[0.4em] tabular-nums`}
        />
      </div>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Checking…" : buttonLabel}
      </button>
    </form>
  );
}
