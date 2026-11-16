"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/projects", label: "Projects" },
  { href: "/containers", label: "Containers" },
  { href: "/rentals", label: "Rentals" },
  { href: "/schedule", label: "Schedule" },
];

/** Navigation links. Vertical on wide screens, a scrolling row on phones. */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium " +
              (active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100")
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
