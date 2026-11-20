// One customer: details, job sites, contacts and notes.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { formatAddress } from "@/lib/format";
import { getCustomer } from "@/server/customers";
import { JOB_SITE_STATUS_LABELS } from "@/server/job-sites";
import { canEditCustomers } from "@/server/permissions";
import { Badge, btn, Card, Details, EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton, ContactForm, NoteForm } from "@/components/inline-forms";
import { NotesTimeline } from "@/components/notes-timeline";
import {
  addContactAction,
  addCustomerNoteAction,
  archiveContactAction,
  archiveCustomerAction,
} from "../actions";

const SITE_TONE = { QUOTE: "amber", ACTIVE: "green", COMPLETED: "gray", CANCELLED: "gray" } as const;

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const result = await getCustomer(session, id);
  if (!result) notFound();
  const { customer, notes } = result;
  const canEdit = canEditCustomers(session);
  const person = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
  const address = formatAddress({
    line1: customer.addressLine1,
    line2: customer.addressLine2,
    city: customer.city,
    state: customer.state,
    postalCode: customer.postalCode,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ href: "/customers", label: "Customers" }}
        title={customer.displayName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {customer.category && <Badge>{customer.category.name}</Badge>}
            {customer.businessName && person && <span>{person}</span>}
            {customer.archivedAt && <Badge tone="red">Archived</Badge>}
          </span>
        }
        actions={
          canEdit && (
            <>
              <Link href={`/customers/${id}/edit`} className={btn.secondary}>
                Edit
              </Link>
              {customer.archivedAt ? (
                <ConfirmButton
                  action={archiveCustomerAction.bind(null, id, false)}
                  label="Restore"
                  confirm="Restore this customer to the active list?"
                  className={btn.secondary}
                />
              ) : (
                <ConfirmButton
                  action={archiveCustomerAction.bind(null, id, true)}
                  label="Archive"
                  confirm="Archive this customer? They'll be hidden from the list but nothing is deleted, and you can restore them any time."
                />
              )}
            </>
          )
        }
      />

      <Card title="Contact details">
        <Details
          items={[
            ["Phone", customer.phone && <a href={`tel:${customer.phone}`} className="underline">{customer.phone}</a>],
            ["Email", customer.email && <a href={`mailto:${customer.email}`} className="underline">{customer.email}</a>],
            ["Address", address],
            ["Notes", customer.notes && <span className="whitespace-pre-wrap">{customer.notes}</span>],
          ]}
        />
      </Card>

      <Card
        title={`Job sites (${customer.projects.length})`}
        actions={
          canEdit && !customer.archivedAt && (
            <Link href={`/customers/${id}/sites/new`} className={btn.primary}>
              + Add job site
            </Link>
          )
        }
      >
        {customer.projects.length === 0 ? (
          <EmptyState>No job sites yet. Add one when this customer books a box.</EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {customer.projects.map((p) => (
              <li key={p.id}>
                <Link href={`/sites/${p.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:opacity-80">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</p>
                    <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                      {[p.siteAddressLine1, p.siteCity].filter(Boolean).join(", ") || "No address yet"}
                      {p.customerReference && ` · Ref ${p.customerReference}`}
                    </p>
                  </div>
                  <Badge tone={SITE_TONE[p.status]}>{JOB_SITE_STATUS_LABELS[p.status]}</Badge>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {p.rentals.length > 0 ? p.rentals.map((r) => r.container.unitNumber).join(", ") : "No boxes"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Other contacts (${customer.contacts.length})`}>
        {customer.contacts.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Add people like an office manager or site foreman, especially for contractors.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {customer.contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {c.name}
                    {c.title && <span className="font-normal text-zinc-500 dark:text-zinc-400"> · {c.title}</span>}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {[c.phone, c.email].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {canEdit && (
                  <form action={archiveContactAction.bind(null, c.id, id)}>
                    <button type="submit" className={btn.link}>
                      Remove
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && <ContactForm action={addContactAction.bind(null, id)} />}
      </Card>

      <Card title="Notes">
        <div className="space-y-4">
          {canEdit && <NoteForm action={addCustomerNoteAction.bind(null, id)} />}
          <NotesTimeline notes={notes} timeZone={session.company.timeZone} />
        </div>
      </Card>
    </div>
  );
}
