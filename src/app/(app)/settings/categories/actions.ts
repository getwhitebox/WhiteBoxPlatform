"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { addCategory, categorySchema, renameCategory, setCategoryArchived } from "@/server/categories";
import { formValues, validationFailed, type ActionState } from "@/server/forms";
import { runAction } from "@/server/run-action";

const PATH = "/settings/categories";

export async function addCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const values = formValues(formData);
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  const failed = await runAction(() => addCategory(session, parsed.data.name), values);
  if (failed) return failed;
  revalidatePath(PATH);
  return { message: "Category added." };
}

export async function renameCategoryAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const values = formValues(formData);
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  const failed = await runAction(() => renameCategory(session, id, parsed.data.name), values);
  if (failed) return failed;
  revalidatePath(PATH);
  return { message: "Saved." };
}

export async function archiveCategoryAction(id: string, archived: boolean): Promise<ActionState> {
  const session = await requireSession();
  const failed = await runAction(() => setCategoryArchived(session, id, archived));
  if (failed) return failed;
  revalidatePath(PATH);
  return {};
}
