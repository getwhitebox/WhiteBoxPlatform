"use client";
// Add / edit job site form.
import Link from "next/link";
import { useActionState, useRef } from "react";
import { FieldGroup, FormError, SelectField, TextArea, TextField } from "@/components/form-fields";
import { btn } from "@/components/ui";
import type { ActionState } from "@/server/forms";

type Values = Partial<Record<string, string | null>>;
type Address = { line1: string; line2: string; city: string; state: string; postalCode: string };

const STATUS_OPTIONS = [
  { value: "QUOTE", label: "Quote (not booked yet)" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function JobSiteForm({ action, initial, customerAddress, cancelHref, submitLabel }: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: Values;
  /** The customer's own address, for the "same as customer" button. */
  customerAddress?: Address;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const v = (name: string) => state.values?.[name] ?? initial?.[name] ?? "";
  const err = (name: string) => state.fieldErrors?.[name];
  const hasNewAddress = Boolean(v("newAddressLine1") || v("newCity"));

  function copyCustomerAddress() {
    const form = formRef.current;
    if (!form || !customerAddress) return;
    const set = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (el) el.value = value;
    };
    set("siteAddressLine1", customerAddress.line1);
    set("siteAddressLine2", customerAddress.line2);
    set("siteCity", customerAddress.city);
    set("siteState", customerAddress.state || "UT");
    set("sitePostalCode", customerAddress.postalCode);
    const name = form.elements.namedItem("name") as HTMLInputElement | null;
    if (name && !name.value && customerAddress.line1) name.value = customerAddress.line1;
  }

  return (
    <form ref={formRef} action={formAction} className="max-w-3xl space-y-4">
      <FieldGroup title="Job site">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            className="sm:col-span-2"
            name="name"
            label="Job site name"
            required
            hint='Usually the street address, e.g. "12 Oak St" or "12 Oak St – water damage"'
            defaultValue={v("name")}
            error={err("name")}
          />
          <SelectField name="status" label="Status" defaultValue={v("status") || "ACTIVE"} options={STATUS_OPTIONS} />
          <TextField
            name="customerReference"
            label="Customer reference"
            hint="PO, job or insurance-claim number (optional)"
            defaultValue={v("customerReference")}
            error={err("customerReference")}
          />
        </div>
      </FieldGroup>

      <FieldGroup title="Delivery address" description="Where the box is dropped off.">
        {customerAddress?.line1 && (
          <button type="button" onClick={copyCustomerAddress} className={btn.secondary}>
            Same as customer address
          </button>
        )}
        <div className="grid gap-3 sm:grid-cols-6">
          <TextField className="sm:col-span-6" name="siteAddressLine1" label="Street address" defaultValue={v("siteAddressLine1")} error={err("siteAddressLine1")} />
          <TextField className="sm:col-span-6" name="siteAddressLine2" label="Apt / suite / unit" defaultValue={v("siteAddressLine2")} />
          <TextField className="sm:col-span-3" name="siteCity" label="City" defaultValue={v("siteCity")} />
          <TextField className="sm:col-span-1" name="siteState" label="State" defaultValue={v("siteState") || "UT"} />
          <TextField className="sm:col-span-2" name="sitePostalCode" label="ZIP" inputMode="numeric" defaultValue={v("sitePostalCode")} />
        </div>
      </FieldGroup>

      <details open={hasNewAddress} className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <summary className="cursor-pointer font-medium text-zinc-900 dark:text-zinc-100">
          Moving? Add the new address
        </summary>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Where the box goes next, often after a stay in our storage yard. Leave empty if the box stays put.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-6">
          <TextField className="sm:col-span-6" name="newAddressLine1" label="New street address" defaultValue={v("newAddressLine1")} />
          <TextField className="sm:col-span-6" name="newAddressLine2" label="Apt / suite / unit" defaultValue={v("newAddressLine2")} />
          <TextField className="sm:col-span-3" name="newCity" label="City" defaultValue={v("newCity")} />
          <TextField className="sm:col-span-1" name="newState" label="State" defaultValue={v("newState")} />
          <TextField className="sm:col-span-2" name="newPostalCode" label="ZIP" inputMode="numeric" defaultValue={v("newPostalCode")} />
        </div>
      </details>

      <FieldGroup title="For the driver">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="accessCode" label="Gate / access code" defaultValue={v("accessCode")} />
          <div className="hidden sm:block" />
          <TextField name="siteContactName" label="Site contact name" defaultValue={v("siteContactName")} />
          <TextField name="siteContactPhone" label="Site contact phone" type="tel" inputMode="tel" defaultValue={v("siteContactPhone")} />
          <TextArea
            className="sm:col-span-2"
            name="placementInstructions"
            label="Placement instructions"
            placeholder="e.g. Left side of driveway, doors facing the street. Watch the sprinkler heads."
            defaultValue={v("placementInstructions")}
          />
        </div>
      </FieldGroup>

      <FieldGroup title="Dates & notes">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="startDate" label="Start date" type="date" defaultValue={v("startDate")} error={err("startDate")} />
          <TextField name="endDate" label="Expected end date" type="date" defaultValue={v("endDate")} error={err("endDate")} />
          <TextArea className="sm:col-span-2" name="notes" label="Notes" defaultValue={v("notes")} />
        </div>
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
