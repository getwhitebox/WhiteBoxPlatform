"use client";
import { useRef } from "react";
import { switchCompany } from "@/app/(app)/actions";

/** Drop-down to switch company. Only shown to people with access to several. */
export function CompanySwitcher({ companies, currentId }: {
  companies: { id: string; name: string }[];
  currentId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={switchCompany}>
      <label htmlFor="companyId" className="sr-only">
        Company
      </label>
      <select
        id="companyId"
        name="companyId"
        defaultValue={currentId}
        onChange={() => formRef.current?.requestSubmit()}
        className="max-w-48 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </form>
  );
}
