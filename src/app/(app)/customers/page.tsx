// Customers list with search and category filter.
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { listCategories, listCustomers } from "@/server/customers";
import { canEditCustomers } from "@/server/permissions";
import { fieldClass } from "@/components/form-fields";
import { Badge, btn, EmptyState, PageHeader } from "@/components/ui";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; archived?: string }>;
}) {
  const { q = "", category = "", archived } = await searchParams;
  const session = await requireSession();
  const showArchived = archived === "1";

  const [customers, categories] = await Promise.all([
    listCustomers(session, { q, categoryId: category || undefined, showArchived }),
    listCategories(session),
  ]);
  const canEdit = canEditCustomers(session);

  return (
    <div>
      <PageHeader
        title={showArchived ? "Archived customers" : "Customers"}
        subtitle={`${customers.length} ${customers.length === 1 ? "customer" : "customers"}${q || category ? " found" : ""}`}
        actions={
          canEdit && (
            <>
              <Link href="/customers/import" className={btn.secondary}>
                Import from Square
              </Link>
              <Link href="/customers/new" className={btn.primary}>
                + Add customer
              </Link>
            </>
          )
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Search customers
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Search name, business, phone, email, address…"
          className={`${fieldClass} min-w-0 flex-1 basis-64`}
        />
        <label htmlFor="category" className="sr-only">
          Category
        </label>
        <select id="category" name="category" defaultValue={category} className={`${fieldClass} w-auto`}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {showArchived && <input type="hidden" name="archived" value="1" />}
        <button type="submit" className={btn.secondary}>
          Search
        </button>
        {(q || category) && (
          <Link href={showArchived ? "/customers?archived=1" : "/customers"} className={`${btn.link} self-center`}>
            Clear
          </Link>
        )}
      </form>

      {customers.length === 0 ? (
        <EmptyState>
          {q || category
            ? "No customers match your search."
            : showArchived
              ? "No archived customers."
              : canEdit
                ? "No customers yet. Add your first one, or import them from Square."
                : "No customers yet."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200 dark:divide-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
          {customers.map((c) => {
            const person = [c.firstName, c.lastName].filter(Boolean).join(" ");
            return (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{c.displayName}</p>
                    <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                      {[c.businessName && person ? person : null, c.phone, c.city].filter(Boolean).join(" · ") ||
                        c.email ||
                        "—"}
                    </p>
                  </div>
                  {c.category && <Badge>{c.category.name}</Badge>}
                  <div className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <span>
                      <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{c.activeSites}</span>{" "}
                      {c.activeSites === 1 ? "site" : "sites"}
                    </span>
                    <span>
                      <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{c.boxesOut}</span>{" "}
                      {c.boxesOut === 1 ? "box" : "boxes"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-sm">
        <Link href={showArchived ? "/customers" : "/customers?archived=1"} className={btn.link}>
          {showArchived ? "← Back to current customers" : "Show archived customers"}
        </Link>
      </p>
    </div>
  );
}
