// Shared helpers for reading and validating form submissions.
import { z } from "zod";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Values the person typed, so the form keeps them after an error. */
  values?: Record<string, string>;
  message?: string;
};

/** Turn a form submission into a plain object of trimmed strings. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value.trim();
  }
  return values;
}

/** Optional text: empty → null. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : null));

export const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `Keep this under ${max} characters.`);

export const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.toLowerCase() : null))
  .pipe(z.email("Enter a valid email address.").nullable());

export const optionalUuid = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable());

export const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.iso.date("Enter a valid date.").nullable())
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

/** Convert a failed validation into field messages for the form. */
export function validationFailed(error: z.ZodError, values: Record<string, string>): ActionState {
  const flat = z.flattenError(error);
  return {
    error: flat.formErrors[0] ?? "Please fix the highlighted fields.",
    fieldErrors: flat.fieldErrors as Record<string, string[] | undefined>,
    values,
  };
}
