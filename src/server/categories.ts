// Customer categories: managed by company admins.
import "server-only";
import { z } from "zod";
import { withUser } from "@/lib/db";
import type { Session } from "@/lib/session";
import { audit } from "@/server/audit";
import { requiredText } from "@/server/forms";
import { canManageSettings, requirePermission } from "@/server/permissions";

export const categorySchema = z.object({ name: requiredText("Category name", 60) });

export async function listCategoriesWithCounts(session: Session) {
  return withUser(session.userId, (db) =>
    db.customerCategory.findMany({
      where: { companyId: session.company.id },
      orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        archivedAt: true,
        _count: { select: { customers: { where: { archivedAt: null } } } },
      },
    }),
  );
}

export async function addCategory(session: Session, name: string) {
  requirePermission(canManageSettings(session));
  return withUser(session.userId, async (db) => {
    const existing = await db.customerCategory.findFirst({
      where: { companyId: session.company.id, name: { equals: name, mode: "insensitive" } },
    });
    if (existing && !existing.archivedAt) throw new Error("A category with that name already exists.");
    if (existing) {
      // Bring back an archived category instead of making a duplicate.
      await db.customerCategory.update({ where: { id: existing.id }, data: { archivedAt: null, name } });
      await audit(db, session, { action: "restore", entityType: "CustomerCategory", entityId: existing.id });
      return;
    }
    const max = await db.customerCategory.aggregate({
      where: { companyId: session.company.id },
      _max: { sortOrder: true },
    });
    const created = await db.customerCategory.create({
      data: { companyId: session.company.id, name, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
    await audit(db, session, { action: "create", entityType: "CustomerCategory", entityId: created.id, after: created });
  });
}

export async function renameCategory(session: Session, id: string, name: string) {
  requirePermission(canManageSettings(session));
  return withUser(session.userId, async (db) => {
    const before = await db.customerCategory.findFirst({ where: { id, companyId: session.company.id } });
    if (!before) throw new Error("Category not found.");
    const clash = await db.customerCategory.findFirst({
      where: { companyId: session.company.id, id: { not: id }, name: { equals: name, mode: "insensitive" } },
    });
    if (clash) throw new Error("A category with that name already exists.");
    const after = await db.customerCategory.update({ where: { id }, data: { name } });
    await audit(db, session, { action: "update", entityType: "CustomerCategory", entityId: id, before, after });
  });
}

export async function setCategoryArchived(session: Session, id: string, archived: boolean) {
  requirePermission(canManageSettings(session));
  return withUser(session.userId, async (db) => {
    const before = await db.customerCategory.findFirst({ where: { id, companyId: session.company.id } });
    if (!before) throw new Error("Category not found.");
    await db.customerCategory.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await audit(db, session, {
      action: archived ? "archive" : "restore",
      entityType: "CustomerCategory",
      entityId: id,
    });
  });
}
