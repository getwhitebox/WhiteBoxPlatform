// All job sites, with search and status filter.
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { JOB_SITE_STATUS_LABELS, listJobSites } from "@/server/job-sites";
import { fieldClass } from "@/components/form-fields";
import { Badge, btn, EmptyState, PageHeader } from "@/components/ui";
import type { ProjectStatus } from "@/generated/prisma/client";

const SITE_TONE = { QUOTE: "amber", ACTIVE: "green", COMPLETED: "gray", CANCELLED: "gray" } as const;
const FILTERS = [
  { value: "OPEN", label: "Open (quote + active)" },
  { value: "ACTIVE", label: "Active" },
  { value: "QUOTE", label: "Quote" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default async function JobSitesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "OPEN" } = await searchParams;
  const session = await requireSession();
  const valid = FILTERS.some((f) => f.value === status) ? status : "OPEN";
  const sites = await listJobSites(session, { q, status: valid as ProjectStatus | "OPEN" });

  return (
    <div>
      <PageHeader
        title="Job sites"
        subtitle="Add a job site from the customer's page."
      />

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Search job sites
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Search site, address, customer, reference…"
          className={`${fieldClass} min-w-0 flex-1 basis-64`}
        />
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <select id="status" name="status" defaultValue={valid} className={`${fieldClass} w-auto`}>
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button type="submit" className={btn.secondary}>
          Search
        </button>
      </form>

      {sites.length === 0 ? (
        <EmptyState>{q ? "No job sites match your search." : "No job sites here yet."}</EmptyState>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200 dark:divide-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
          {sites.map((s) => (
            <li key={s.id}>
              <Link
                href={`/sites/${s.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{s.name}</p>
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {s.customer.displayName}
                    {s.siteCity && ` · ${s.siteCity}`}
                    {s.customerReference && ` · Ref ${s.customerReference}`}
                  </p>
                </div>
                {s.newAddressLine1 && <Badge tone="blue">Moving</Badge>}
                <Badge tone={SITE_TONE[s.status]}>{JOB_SITE_STATUS_LABELS[s.status]}</Badge>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{s._count.rentals}</span>{" "}
                  {s._count.rentals === 1 ? "box" : "boxes"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
