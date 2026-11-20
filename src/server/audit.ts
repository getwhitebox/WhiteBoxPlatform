// Writes an entry to the permanent audit log (who changed what, when).
import "server-only";
import type { Db } from "@/lib/db";
import type { Session } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";

export async function audit(
  db: Db,
  session: Session,
  entry: {
    action: "create" | "update" | "archive" | "restore" | "import";
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await db.auditLog.create({
    data: {
      organizationId: session.company.organizationId,
      companyId: session.company.id,
      userId: session.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: toJson(entry.before),
      after: toJson(entry.after),
    },
  });
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
