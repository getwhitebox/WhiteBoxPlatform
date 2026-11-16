// Layout for every logged-in page: header, navigation, company switcher.
import type { ReactNode } from "react";
import { signOut } from "@/app/auth-actions";
import { AppNav } from "@/components/app-nav";
import { CompanySwitcher } from "@/components/company-switcher";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-100 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-zinc-900 text-sm font-bold text-zinc-900 dark:border-zinc-100 dark:text-zinc-100">
              WB
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                {session.company.brandName}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {session.company.organizationName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session.companies.length > 1 && (
              <CompanySwitcher
                companies={session.companies.map(({ id, name }) => ({ id, name }))}
                currentId={session.company.id}
              />
            )}
            <span className="hidden text-sm text-zinc-500 sm:inline dark:text-zinc-400">
              {session.fullName ?? session.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 md:flex-row md:gap-6 md:py-6">
        <aside className="md:w-48 md:shrink-0">
          <AppNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
