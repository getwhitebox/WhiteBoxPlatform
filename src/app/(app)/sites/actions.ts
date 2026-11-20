"use server";
// Form actions for job sites.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { createJobSite, jobSiteSchema, updateJobSite } from "@/server/job-sites";
import { addNote, noteSchema } from "@/server/contacts-notes";
import { formValues, validationFailed, type ActionState } from "@/server/forms";
import { runAction } from "@/server/run-action";

export async function createJobSiteAction(
  customerId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const values = formValues(formData);
  const parsed = jobSiteSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);

  let id = "";
  const failed = await runAction(async () => {
    id = (await createJobSite(session, customerId, parsed.data)).id;
  }, values);
  if (failed) return failed;
  redirect(`/sites/${id}`);
}

export async function updateJobSiteAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const values = formValues(formData);
  const parsed = jobSiteSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);

  const failed = await runAction(() => updateJobSite(session, id, parsed.data).then(() => {}), values);
  if (failed) return failed;
  redirect(`/sites/${id}`);
}

export async function addJobSiteNoteAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const values = formValues(formData);
  const parsed = noteSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);

  const failed = await runAction(() => addNote(session, { type: "PROJECT", id }, parsed.data.body), values);
  if (failed) return failed;
  revalidatePath(`/sites/${id}`);
  return { message: "Note added." };
}
