import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getJobSite } from "@/server/job-sites";
import { canEditCustomers } from "@/server/permissions";
import { PageHeader } from "@/components/ui";
import { updateJobSiteAction } from "../../actions";
import { JobSiteForm } from "../../job-site-form";

const dateValue = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditJobSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canEditCustomers(session)) redirect(`/sites/${id}`);
  const result = await getJobSite(session, id);
  if (!result) notFound();
  const { site } = result;
  const c = site.customer;

  return (
    <div>
      <PageHeader title={`Edit ${site.name}`} back={{ href: `/sites/${id}`, label: site.name }} />
      <JobSiteForm
        action={updateJobSiteAction.bind(null, id)}
        cancelHref={`/sites/${id}`}
        submitLabel="Save changes"
        customerAddress={{
          line1: c.addressLine1 ?? "",
          line2: c.addressLine2 ?? "",
          city: c.city ?? "",
          state: c.state ?? "",
          postalCode: c.postalCode ?? "",
        }}
        initial={{
          name: site.name,
          status: site.status,
          customerReference: site.customerReference,
          siteAddressLine1: site.siteAddressLine1,
          siteAddressLine2: site.siteAddressLine2,
          siteCity: site.siteCity,
          siteState: site.siteState,
          sitePostalCode: site.sitePostalCode,
          newAddressLine1: site.newAddressLine1,
          newAddressLine2: site.newAddressLine2,
          newCity: site.newCity,
          newState: site.newState,
          newPostalCode: site.newPostalCode,
          accessCode: site.accessCode,
          placementInstructions: site.placementInstructions,
          siteContactName: site.siteContactName,
          siteContactPhone: site.siteContactPhone,
          startDate: dateValue(site.startDate),
          endDate: dateValue(site.endDate),
          notes: site.notes,
        }}
      />
    </div>
  );
}
