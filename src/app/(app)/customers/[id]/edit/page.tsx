import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getCustomer, listCategories } from "@/server/customers";
import { canEditCustomers } from "@/server/permissions";
import { PageHeader } from "@/components/ui";
import { updateCustomerAction } from "../../actions";
import { CustomerForm } from "../../customer-form";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!canEditCustomers(session)) redirect(`/customers/${id}`);

  const [result, categories] = await Promise.all([getCustomer(session, id), listCategories(session)]);
  if (!result) notFound();
  const { customer } = result;

  return (
    <div>
      <PageHeader title={`Edit ${customer.displayName}`} back={{ href: `/customers/${id}`, label: customer.displayName }} />
      <CustomerForm
        action={updateCustomerAction.bind(null, id)}
        categories={categories}
        cancelHref={`/customers/${id}`}
        submitLabel="Save changes"
        initial={{
          firstName: customer.firstName,
          lastName: customer.lastName,
          businessName: customer.businessName,
          categoryId: customer.categoryId,
          phone: customer.phone,
          email: customer.email,
          addressLine1: customer.addressLine1,
          addressLine2: customer.addressLine2,
          city: customer.city,
          state: customer.state,
          postalCode: customer.postalCode,
          notes: customer.notes,
        }}
      />
    </div>
  );
}
