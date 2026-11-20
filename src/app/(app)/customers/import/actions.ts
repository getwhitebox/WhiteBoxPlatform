"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { mapRow, previewImport, runImport, type RowResult } from "@/server/square-import";
import { PermissionError } from "@/server/permissions";

const rowsSchema = z.array(z.record(z.string(), z.unknown())).max(2000);

type PreviewResult = { results?: RowResult[]; error?: string };
type ImportResult = {
  summary?: { created: number; alreadyImported: number; possibleDuplicates: number; skipped: number };
  error?: string;
};

function message(e: unknown) {
  if (e instanceof PermissionError) return e.message;
  if (e instanceof Error && /limited to|doesn't belong/.test(e.message)) return e.message;
  console.error("Import failed:", e);
  return "Something went wrong. Nothing was imported. Please try again.";
}

export async function previewImportAction(rawRows: unknown): Promise<PreviewResult> {
  const session = await requireSession();
  const parsed = rowsSchema.safeParse(rawRows);
  if (!parsed.success) return { error: "That file couldn't be read as a customer list." };
  try {
    return { results: await previewImport(session, parsed.data.map(mapRow)) };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function runImportAction(rawRows: unknown, categoryId: string): Promise<ImportResult> {
  const session = await requireSession();
  const parsed = rowsSchema.safeParse(rawRows);
  const category = z.uuid().nullable().safeParse(categoryId || null);
  if (!parsed.success || !category.success) return { error: "That file couldn't be read as a customer list." };
  try {
    const summary = await runImport(session, parsed.data.map(mapRow), category.data);
    revalidatePath("/customers");
    return { summary };
  } catch (e) {
    return { error: message(e) };
  }
}
