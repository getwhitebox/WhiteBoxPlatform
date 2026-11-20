// Turns expected problems (no permission, record not found…) into a message
// on the form instead of a crash page.
import "server-only";
import { PermissionError } from "@/server/permissions";
import type { ActionState } from "@/server/forms";

const SAFE_MESSAGES = [
  "not found",
  "doesn't belong",
  "still has boxes",
  "already exists",
];

export async function runAction(
  work: () => Promise<void>,
  values?: Record<string, string>,
): Promise<ActionState | undefined> {
  try {
    await work();
    return undefined;
  } catch (e) {
    if (e instanceof PermissionError) return { error: e.message, values };
    const message = e instanceof Error ? e.message : String(e);
    if (SAFE_MESSAGES.some((s) => message.toLowerCase().includes(s))) return { error: message, values };
    if (/unique constraint/i.test(message)) return { error: "That already exists.", values };
    console.error("Action failed:", e);
    return { error: "Something went wrong saving this. Please try again.", values };
  }
}
