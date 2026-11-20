"use client";
import { useActionState, useEffect, useRef } from "react";
import { fieldClass } from "@/components/form-fields";
import { btn } from "@/components/ui";
import type { ActionState } from "@/server/forms";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function AddCategoryForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={formAction} className="flex flex-wrap items-start gap-2">
      <label htmlFor="new-category" className="sr-only">
        New category name
      </label>
      <input id="new-category" name="name" placeholder="e.g. Property manager" className={`${fieldClass} max-w-xs`} />
      <button type="submit" disabled={pending} className={btn.primary}>
        Add category
      </button>
      {(state.fieldErrors?.name?.[0] ?? state.error) && (
        <p className="basis-full text-sm text-red-700 dark:text-red-300">{state.fieldErrors?.name?.[0] ?? state.error}</p>
      )}
    </form>
  );
}

export function RenameCategoryForm({ action, name }: { action: Action; name: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`cat-${name}`}>
        Category name
      </label>
      <input id={`cat-${name}`} name="name" defaultValue={name} className={`${fieldClass} max-w-xs`} />
      <button type="submit" disabled={pending} className={btn.secondary}>
        Save
      </button>
      {state.message && <span className="text-sm text-emerald-700 dark:text-emerald-300">{state.message}</span>}
      {(state.fieldErrors?.name?.[0] ?? state.error) && (
        <span className="text-sm text-red-700 dark:text-red-300">{state.fieldErrors?.name?.[0] ?? state.error}</span>
      )}
    </form>
  );
}
