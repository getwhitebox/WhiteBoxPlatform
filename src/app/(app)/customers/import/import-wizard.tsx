"use client";
// Square import: choose file → preview → import.
import Link from "next/link";
import Papa from "papaparse";
import { useState, useTransition } from "react";
import { fieldClass } from "@/components/form-fields";
import { Badge, btn, Card } from "@/components/ui";
import type { RowResult } from "@/server/square-import";
import { previewImportAction, runImportAction } from "./actions";

const OUTCOME = {
  new: { label: "Will be added", tone: "green" },
  "already-imported": { label: "Already imported", tone: "gray" },
  "possible-duplicate": { label: "Possible duplicate – skipped", tone: "amber" },
  skipped: { label: "Skipped", tone: "red" },
} as const;

type Summary = { created: number; alreadyImported: number; possibleDuplicates: number; skipped: number };

export function ImportWizard({ categories }: { categories: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [filter, setFilter] = useState<keyof typeof OUTCOME | "all">("all");
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    setError("");
    setResults(null);
    setSummary(null);
    if (!file) return;
    setFileName(file.name);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: ({ data, errors }) => {
        if (data.length === 0) {
          setError(errors[0]?.message ?? "That file has no customer rows.");
          return;
        }
        setRows(data);
        startTransition(async () => {
          const res = await previewImportAction(data);
          if (res.error) setError(res.error);
          else setResults(res.results ?? []);
        });
      },
      error: (e) => setError(`That file couldn't be read: ${e.message}`),
    });
  }

  function onImport() {
    if (!rows) return;
    startTransition(async () => {
      const res = await runImportAction(rows, categoryId);
      if (res.error) setError(res.error);
      else setSummary(res.summary ?? null);
    });
  }

  if (summary) {
    return (
      <Card title="Import complete">
        <ul className="mb-4 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
          <li><strong>{summary.created}</strong> customers added</li>
          <li>{summary.alreadyImported} already imported before</li>
          <li>{summary.possibleDuplicates} possible duplicates skipped (check these by hand)</li>
          <li>{summary.skipped} rows skipped (missing name or invalid email)</li>
        </ul>
        <Link href="/customers" className={btn.primary}>
          Go to customers
        </Link>
      </Card>
    );
  }

  const counts = results
    ? (Object.keys(OUTCOME) as (keyof typeof OUTCOME)[]).map((k) => [k, results.filter((r) => r.outcome === k).length] as const)
    : [];
  const toAdd = results?.filter((r) => r.outcome === "new").length ?? 0;
  const shown = results?.filter((r) => filter === "all" || r.outcome === filter) ?? [];

  return (
    <div className="space-y-4">
      <Card title="1. Export from Square">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>In Square, open <strong>Customers</strong> → <strong>Customer directory</strong>.</li>
          <li>Choose <strong>Export customers</strong> and download the CSV file.</li>
        </ol>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Nothing in Square is changed. The file is only read.
        </p>
      </Card>

      <Card title="2. Choose the file">
        <label htmlFor="file" className="sr-only">
          Square customer CSV file
        </label>
        <input
          id="file"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-white dark:text-zinc-300 dark:file:bg-zinc-100 dark:file:text-zinc-900"
        />
        {pending && !results && <p className="mt-2 text-sm text-zinc-500">Checking {fileName}…</p>}
        {error && (
          <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
      </Card>

      {results && (
        <Card title={`3. Review ${results.length} rows from ${fileName}`}>
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setFilter("all")} className={filter === "all" ? btn.primary : btn.secondary}>
              All {results.length}
            </button>
            {counts.map(([k, n]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={filter === k ? btn.primary : btn.secondary}>
                {OUTCOME[k].label}: {n}
              </button>
            ))}
          </div>

          <div className="max-h-96 overflow-auto rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {shown.map((r) => (
                  <tr key={r.row}>
                    <td className="px-3 py-2 tabular-nums text-zinc-500">{r.row}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{r.name}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{r.detail}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={OUTCOME[r.outcome].tone}>{OUTCOME[r.outcome].label}</Badge>
                      {r.reason && <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{r.reason}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="categoryId" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Category for the new customers (optional)
              </label>
              <select id="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${fieldClass} w-auto`}>
                <option value="">— None, I&apos;ll set them later —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={onImport} disabled={pending || toAdd === 0} className={btn.primary}>
              {pending ? "Importing…" : `Import ${toAdd} new ${toAdd === 1 ? "customer" : "customers"}`}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
