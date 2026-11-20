"use client";
// Small forms used inside detail pages: notes, contacts, confirm buttons.
import { useActionState, useEffect, useRef } from "react";
import { FormError, TextArea, TextField } from "@/components/form-fields";
import { btn } from "@/components/ui";
import type { ActionState } from "@/server/forms";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Clears the form after a successful save. */
function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message && !state.error) ref.current?.reset();
  }, [state]);
  return ref;
}

export function NoteForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={formAction} className="space-y-2">
      <TextArea
        name="body"
        label="Add a note"
        rows={2}
        placeholder="e.g. Called about extending the rental another month"
        defaultValue={state.error ? state.values?.body : ""}
        error={state.fieldErrors?.body}
      />
      <FormError error={state.fieldErrors?.body ? undefined : state.error} />
      <button type="submit" disabled={pending} className={btn.secondary}>
        {pending ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}

export function ContactForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useResetOnSuccess(state);
  const v = (n: string) => (state.error ? state.values?.[n] : "");
  return (
    <details className="group mt-3" open={Boolean(state.error)}>
      <summary className={`${btn.secondary} cursor-pointer list-none`}>+ Add contact</summary>
      <form ref={ref} action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
        <TextField name="name" label="Name" required defaultValue={v("name")} error={state.fieldErrors?.name} />
        <TextField name="title" label="Role" placeholder="e.g. Site foreman, Office manager" defaultValue={v("title")} />
        <TextField name="phone" label="Phone" type="tel" inputMode="tel" defaultValue={v("phone")} />
        <TextField name="email" label="Email" type="email" defaultValue={v("email")} error={state.fieldErrors?.email} />
        <div className="sm:col-span-2 space-y-2">
          <FormError error={state.fieldErrors ? undefined : state.error} />
          <button type="submit" disabled={pending} className={btn.primary}>
            {pending ? "Saving…" : "Save contact"}
          </button>
        </div>
      </form>
    </details>
  );
}

/** A button that asks "Are you sure?" before running an action. */
export function ConfirmButton({ action, label, confirm, className = btn.danger }: {
  action: Action;
  label: string;
  confirm: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      className="inline-flex flex-col items-end gap-1"
    >
      <button type="submit" disabled={pending} className={className}>
        {pending ? "Working…" : label}
      </button>
      {state.error && <span className="max-w-xs text-right text-xs text-red-700 dark:text-red-300">{state.error}</span>}
    </form>
  );
}
