import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getCustomerForNewSite } from "@/server/job-sites";
import { canEditCustomers } from "@/server/permissions";
import { PageHeader } from "@/components/ui";
import { createJobSiteAction } from "../../../../sites/actions";
import { JobSiteForm } from "../../../../sites/job-site-form";

export default async function NewJobSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canEditCustomers(session)) redirect(`/customers/${id}`);
  const customer = await getCustomerForNewSite(session, id);
  if (!customer) notFound();

  return (
    <div>
      <PageHeader
        title="Add job site"
        subtitle={`for ${customer.displayName}`}
        back={{ href: `/customers/${id}`, label: customer.displayName }}
      />
      <JobSiteForm
        action={createJobSiteAction.bind(null, id)}
        cancelHref={`/customers/${id}`}
        submitLabel="Save job site"
        customerAddress={{
          line1: customer.addressLine1 ?? "",
          line2: customer.addressLine2 ?? "",
          city: customer.city ?? "",
          state: customer.state ?? "",
          postalCode: customer.postalCode ?? "",
        }}
      />
    </div>
  );
}
