"use server";
// Form actions for customers, their contacts and notes.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import {
  createCustomer,
  customerSchema,
  setCustomerArchived,
  updateCustomer,
} from "@/server/customers";
import { addContact, addNote, archiveContact, contactSchema, noteSchema } from "@/server/contacts-notes";
import { formValues, validationFailed, type ActionState } from "@/server/forms";
import { runAction } from "@/server/run-action";

export async function createCustomerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const values = formValues(formData);
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);

  let id = "";
  const failed = await runAction(async () => {
    id = (await createCustomer(session, parsed.data)).id;
  }, values);
  if (failed) return failed;
  redirect(`/customers/${id}`);
}

export async function updateCustomerAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const values = formValues(formData);
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);

  const failed = await runAction(() => updateCustomer(session, id, parsed.data).then(() => {}), values);
  if (failed) return failed;
  redirect(`/customers/${id}`);
}

export async function archiveCustomerAction(id: string, archived: boolean): Promise<ActionState> {
  const session = await requireSession();
  const failed = await runAction(() => setCustomerArchived(session, id, archived));
  if (failed) return failed;
  revalidatePath(`/customers/${id}`);
  return { message: archived ? "Customer archived." : "Customer restored." };
}

export async function addContactAction(
  customerId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const values = formValues(formData);
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);

  const failed = await runAction(() => addContact(session, customerId, parsed.data), values);
  if (failed) return failed;
  revalidatePath(`/customers/${customerId}`);
  return { message: "Contact added." };
}

export async function archiveContactAction(contactId: string, customerId: string) {
  const session = await requireSession();
  await runAction(() => archiveContact(session, contactId).then(() => {}));
  revalidatePath(`/customers/${customerId}`);
}

export async function addCustomerNoteAction(
  customerId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const values = formValues(formData);
  const parsed = noteSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);

  const failed = await runAction(
    () => addNote(session, { type: "CUSTOMER", id: customerId }, parsed.data.body),
    values,
  );
  if (failed) return failed;
  revalidatePath(`/customers/${customerId}`);
  return { message: "Note added." };
}
