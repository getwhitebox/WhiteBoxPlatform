// Form inputs with labels and error messages.
import type { ReactNode } from "react";

export const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300";

type Common = {
  name: string;
  label: string;
  defaultValue?: string | null;
  error?: string[];
  hint?: ReactNode;
  required?: boolean;
  className?: string;
};

function Wrapper({ name, label, error, hint, required, className = "", children }: Common & { children: ReactNode }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
      {error?.map((e) => (
        <p key={e} className="text-xs text-red-700 dark:text-red-300">
          {e}
        </p>
      ))}
    </div>
  );
}

export function TextField(
  props: Common & {
    type?: string;
    autoComplete?: string;
    inputMode?: "text" | "tel" | "email" | "numeric";
    placeholder?: string;
  },
) {
  const { name, defaultValue, error, type = "text", autoComplete, inputMode, placeholder, required } = props;
  return (
    <Wrapper {...props}>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? true : undefined}
        className={fieldClass}
      />
    </Wrapper>
  );
}

export function TextArea(props: Common & { rows?: number; placeholder?: string }) {
  const { name, defaultValue, error, rows = 3, placeholder } = props;
  return (
    <Wrapper {...props}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={fieldClass}
      />
    </Wrapper>
  );
}

export function SelectField(
  props: Common & { options: { value: string; label: string }[]; emptyLabel?: string },
) {
  const { name, defaultValue, error, options, emptyLabel } = props;
  return (
    <Wrapper {...props}>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        aria-invalid={error ? true : undefined}
        className={fieldClass}
      >
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {error}
    </p>
  );
}

export function FieldGroup({ title, children, description }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="font-medium text-zinc-900 dark:text-zinc-100">{title}</h2>
        {description && <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      {children}
    </fieldset>
  );
}
