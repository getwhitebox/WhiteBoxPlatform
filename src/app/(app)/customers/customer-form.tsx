"use client";
// Add / edit customer form.
import Link from "next/link";
import { useActionState } from "react";
import { FieldGroup, FormError, SelectField, TextArea, TextField } from "@/components/form-fields";
import { btn } from "@/components/ui";
import type { ActionState } from "@/server/forms";

type Values = Partial<Record<string, string | null>>;

export function CustomerForm({ action, categories, initial, cancelHref, submitLabel }: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  categories: { id: string; name: string }[];
  initial?: Values;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // After an error, show what was typed; otherwise the saved values.
  const v = (name: string) => state.values?.[name] ?? initial?.[name] ?? "";
  const err = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="max-w-3xl space-y-4">
      <FieldGroup title="Customer" description="Enter a person's name, a business name, or both.">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="firstName" label="First name" defaultValue={v("firstName")} error={err("firstName")} autoComplete="off" />
          <TextField name="lastName" label="Last name" defaultValue={v("lastName")} error={err("lastName")} autoComplete="off" />
          <TextField
            name="businessName"
            label="Business name"
            hint="For remodelers and contractors"
            defaultValue={v("businessName")}
            error={err("businessName")}
            autoComplete="off"
          />
          <SelectField
            name="categoryId"
            label="Category"
            defaultValue={v("categoryId")}
            error={err("categoryId")}
            emptyLabel="— Choose —"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
      </FieldGroup>

      <FieldGroup title="Contact">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="phone" label="Phone" type="tel" inputMode="tel" defaultValue={v("phone")} error={err("phone")} />
          <TextField name="email" label="Email" type="email" inputMode="email" defaultValue={v("email")} error={err("email")} />
        </div>
      </FieldGroup>

      <FieldGroup title="Address">
        <div className="grid gap-3 sm:grid-cols-6">
          <TextField className="sm:col-span-6" name="addressLine1" label="Street address" defaultValue={v("addressLine1")} error={err("addressLine1")} />
          <TextField className="sm:col-span-6" name="addressLine2" label="Apt / suite / unit" defaultValue={v("addressLine2")} error={err("addressLine2")} />
          <TextField className="sm:col-span-3" name="city" label="City" defaultValue={v("city")} error={err("city")} />
          <TextField className="sm:col-span-1" name="state" label="State" defaultValue={v("state") || "UT"} error={err("state")} />
          <TextField className="sm:col-span-2" name="postalCode" label="ZIP" inputMode="numeric" defaultValue={v("postalCode")} error={err("postalCode")} />
        </div>
      </FieldGroup>

      <FieldGroup title="Notes">
        <TextArea name="notes" label="General notes about this customer" defaultValue={v("notes")} error={err("notes")} />
      </FieldGroup>

      <FormError error={state.error} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href={cancelHref} className={btn.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
