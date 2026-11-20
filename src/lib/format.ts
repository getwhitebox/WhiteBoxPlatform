// Small helpers for showing and tidying up common values.

/** "(435) 555-0123" for 10-digit US numbers; otherwise returns what was typed. */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return raw.trim();
}

/** Digits only, for searching phone numbers however they were typed. */
export function phoneDigits(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim();
}

/** How a customer appears in lists: business name if any, else the person's name. */
export function customerDisplayName(c: {
  businessName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  return c.businessName?.trim() || fullName(c.firstName, c.lastName) || "Unnamed customer";
}

export function formatAddress(a: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}): string {
  const street = [a.line1, a.line2].filter(Boolean).join(", ");
  const cityLine = [a.city, [a.state, a.postalCode].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [street, cityLine].filter(Boolean).join(", ");
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);
}

export function formatDateTime(d: Date | null | undefined, timeZone = "America/Denver"): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(d);
}
