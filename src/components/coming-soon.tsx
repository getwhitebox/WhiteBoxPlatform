/** Placeholder for sections that are built in later phases. */
export function ComingSoon({ title, phase, description }: {
  title: string;
  phase: number;
  description: string;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
      <div className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Coming in Phase {phase}</p>
        <p className="mt-1 text-zinc-700 dark:text-zinc-300">{description}</p>
      </div>
    </div>
  );
}
