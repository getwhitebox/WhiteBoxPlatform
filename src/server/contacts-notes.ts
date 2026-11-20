// =============================================================================
// Extra customer contacts, and timeline notes on customers and job sites.
// =============================================================================
import "server-only";
import { z } from "zod";
import { withUser } from "@/lib/db";
import type { Session } from "@/lib/session";
import { formatPhone } from "@/lib/format";
import { audit } from "@/server/audit";
import { optionalEmail, optionalText, requiredText } from "@/server/forms";
import { canEditCustomers, requirePermission } from "@/server/permissions";

export const contactSchema = z.object({
  name: requiredText("Name", 150),
  title: optionalText(100),
  phone: optionalText(40),
  email: optionalEmail,
});
export type ContactInput = z.infer<typeof contactSchema>;

export async function addContact(session: Session, customerId: string, input: ContactInput) {
  requirePermission(canEditCustomers(session));
  return withUser(session.userId, async (db) => {
    const customer = await db.customer.findFirst({
      where: { id: customerId, companyId: session.company.id },
      select: { id: true },
    });
    if (!customer) throw new Error("Customer not found.");
    const contact = await db.customerContact.create({
      data: {
        ...input,
        phone: input.phone ? formatPhone(input.phone) : null,
        customerId,
        companyId: session.company.id,
      },
    });
    await audit(db, session, { action: "create", entityType: "CustomerContact", entityId: contact.id, after: contact });
  });
}

export async function archiveContact(session: Session, contactId: string) {
  requirePermission(canEditCustomers(session));
  return withUser(session.userId, async (db) => {
    const before = await db.customerContact.findFirst({
      where: { id: contactId, companyId: session.company.id, archivedAt: null },
    });
    if (!before) throw new Error("Contact not found.");
    await db.customerContact.update({ where: { id: contactId }, data: { archivedAt: new Date() } });
    await audit(db, session, { action: "archive", entityType: "CustomerContact", entityId: contactId, before });
    return before.customerId;
  });
}

export const noteSchema = z.object({ body: requiredText("Note", 5000) });

export async function addNote(
  session: Session,
  subject: { type: "CUSTOMER" | "PROJECT"; id: string },
  body: string,
) {
  requirePermission(canEditCustomers(session));
  return withUser(session.userId, async (db) => {
    // The subject must belong to the current company.
    const exists =
      subject.type === "CUSTOMER"
        ? await db.customer.count({ where: { id: subject.id, companyId: session.company.id } })
        : await db.project.count({ where: { id: subject.id, companyId: session.company.id } });
    if (!exists) throw new Error("Record not found.");

    await db.activityNote.create({
      data: {
        companyId: session.company.id,
        subjectType: subject.type,
        subjectId: subject.id,
        body,
        authorUserId: session.userId,
      },
    });
  });
}
