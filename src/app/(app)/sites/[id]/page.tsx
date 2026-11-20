// One job site: addresses, driver details, containers and notes.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { formatAddress, formatDate } from "@/lib/format";
import { CONTAINER_STATUS_LABELS } from "@/lib/labels";
import { getJobSite, JOB_SITE_STATUS_LABELS } from "@/server/job-sites";
import { canEditCustomers } from "@/server/permissions";
import { Badge, btn, Card, Details, EmptyState, PageHeader } from "@/components/ui";
import { NoteForm } from "@/components/inline-forms";
import { NotesTimeline } from "@/components/notes-timeline";
import { addJobSiteNoteAction } from "../actions";

const SITE_TONE = { QUOTE: "amber", ACTIVE: "green", COMPLETED: "gray", CANCELLED: "gray" } as const;

export default async function JobSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const result = await getJobSite(session, id);
  if (!result) notFound();
  const { site, notes } = result;
  const canEdit = canEditCustomers(session);

  const deliveryAddress = formatAddress({
    line1: site.siteAddressLine1,
    line2: site.siteAddressLine2,
    city: site.siteCity,
    state: site.siteState,
    postalCode: site.sitePostalCode,
  });
  const newAddress = formatAddress({
    line1: site.newAddressLine1,
    line2: site.newAddressLine2,
    city: site.newCity,
    state: site.newState,
    postalCode: site.newPostalCode,
  });
  const mapsLink = (address: string) =>
    address && (
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        {address}
      </a>
    );

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ href: `/customers/${site.customer.id}`, label: site.customer.displayName }}
        title={site.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={SITE_TONE[site.status]}>{JOB_SITE_STATUS_LABELS[site.status]}</Badge>
            {newAddress && <Badge tone="blue">Moving</Badge>}
            <Link href={`/customers/${site.customer.id}`} className="underline">
              {site.customer.displayName}
            </Link>
            {site.customerReference && <span>Ref {site.customerReference}</span>}
          </span>
        }
        actions={
          canEdit && (
            <Link href={`/sites/${id}/edit`} className={btn.secondary}>
              Edit
            </Link>
          )
        }
      />

      <Card title="Addresses">
        <Details
          items={[
            ["Delivery address", mapsLink(deliveryAddress)],
            ["Moving to", mapsLink(newAddress)],
            ["Start date", formatDate(site.startDate)],
            ["Expected end date", formatDate(site.endDate)],
          ]}
        />
      </Card>

      <Card title="For the driver">
        <Details
          items={[
            ["Gate / access code", site.accessCode],
            ["Site contact", [site.siteContactName, site.siteContactPhone].filter(Boolean).join(" · ")],
            ["Placement instructions", site.placementInstructions && <span className="whitespace-pre-wrap">{site.placementInstructions}</span>],
            ["Customer phone", site.customer.phone && <a href={`tel:${site.customer.phone}`} className="underline">{site.customer.phone}</a>],
            ["Notes", site.notes && <span className="whitespace-pre-wrap">{site.notes}</span>],
          ]}
        />
      </Card>

      <Card title="Containers">
        {site.rentals.length === 0 ? (
          <EmptyState>No containers on this job site yet. Assigning containers comes in Phase 6 (Rentals).</EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {site.rentals.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.container.unitNumber}</span>
                <Badge>{CONTAINER_STATUS_LABELS[r.container.status]}</Badge>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {formatDate(r.startDate)}
                  {r.endDate && ` – ${formatDate(r.endDate)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Notes">
        <div className="space-y-4">
          {canEdit && <NoteForm action={addJobSiteNoteAction.bind(null, id)} />}
          <NotesTimeline notes={notes} timeZone={session.company.timeZone} />
        </div>
      </Card>
    </div>
  );
}
