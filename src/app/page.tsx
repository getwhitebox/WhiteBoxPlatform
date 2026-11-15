const phases = [
  { name: "Environment & accounts", done: true },
  { name: "Project skeleton", done: true },
  { name: "Database foundation", done: false },
  { name: "Login & permissions", done: false },
  { name: "Customers & projects", done: false },
  { name: "Container inventory & history", done: false },
  { name: "Rentals", done: false },
  { name: "Jobs & scheduling", done: false },
];

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-100 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-zinc-900 bg-white text-lg font-bold text-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:text-zinc-100">
            WB
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Hello, White Box
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Mobile Storage Platform
            </p>
          </div>
        </div>

        <p className="mb-6 text-zinc-600 dark:text-zinc-300">
          The platform is up and running. Here&apos;s where the build stands:
        </p>

        <ol className="space-y-2">
          {phases.map((phase, i) => (
            <li key={phase.name} className="flex items-center gap-3 text-sm">
              <span
                className={
                  phase.done
                    ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-medium text-white"
                    : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }
              >
                {phase.done ? "✓" : i}
              </span>
              <span
                className={
                  phase.done
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 dark:text-zinc-400"
                }
              >
                Phase {i}: {phase.name}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
