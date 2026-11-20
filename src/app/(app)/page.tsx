// Dashboard: a first look at live data, read through the security rules.
import { withUser } from "@/lib/db";
import { requireSession } from "@/lib/session";
import type { ContainerStatus } from "@/generated/prisma/client";
import { CONTAINER_STATUS_LABELS } from "@/lib/labels";

const STATUS_LABELS = CONTAINER_STATUS_LABELS;

export default async function DashboardPage() {
  const session = await requireSession();

  const { byStatus, yards } = await withUser(session.userId, async (db) => {
    const byStatus = await db.container.groupBy({
      by: ["status"],
      where: { companyId: session.company.id, archivedAt: null },
      _count: { _all: true },
    });
    const yards = await db.location.findMany({
      where: { companyId: session.company.id, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true, state: true },
    });
    return { byStatus, yards };
  });

  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Partial<
    Record<ContainerStatus, number>
  >;
  const total = byStatus.reduce((sum, s) => sum + s._count._all, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{session.company.name}</p>
      </div>

      <section aria-labelledby="fleet" className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <h2 id="fleet" className="mb-4 font-medium text-zinc-900 dark:text-zinc-100">
          Fleet · {total} containers
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {(Object.keys(STATUS_LABELS) as ContainerStatus[]).map((status) => (
            <div key={status} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">{STATUS_LABELS[status]}</dt>
              <dd className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {counts[status] ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="yards" className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <h2 id="yards" className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">
          Yards
        </h2>
        <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
          {yards.map((y) => (
            <li key={y.id}>
              {y.name}
              {y.city && (
                <span className="text-zinc-500 dark:text-zinc-400">
                  {" "}
                  · {y.city}, {y.state}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
