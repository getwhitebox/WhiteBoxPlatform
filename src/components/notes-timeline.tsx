import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui";

export function NotesTimeline({ notes, timeZone }: {
  notes: { id: string; body: string; createdAt: Date; author: { fullName: string | null; email: string } | null }[];
  timeZone: string;
}) {
  if (notes.length === 0) return <EmptyState>No notes yet.</EmptyState>;
  return (
    <ol className="space-y-3">
      {notes.map((n) => (
        <li key={n.id} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
          <p className="whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">{n.body}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {n.author?.fullName ?? n.author?.email ?? "Unknown"} · {formatDateTime(n.createdAt, timeZone)}
          </p>
        </li>
      ))}
    </ol>
  );
}
