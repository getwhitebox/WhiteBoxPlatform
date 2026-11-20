import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { listCategories } from "@/server/customers";
import { canEditCustomers } from "@/server/permissions";
import { PageHeader } from "@/components/ui";
import { createCustomerAction } from "../actions";
import { CustomerForm } from "../customer-form";

export default async function NewCustomerPage() {
  const session = await requireSession();
  if (!canEditCustomers(session)) redirect("/customers");
  const categories = await listCategories(session);

  return (
    <div>
      <PageHeader title="Add customer" back={{ href: "/customers", label: "Customers" }} />
      <CustomerForm
        action={createCustomerAction}
        categories={categories}
        cancelHref="/customers"
        submitLabel="Save customer"
      />
    </div>
  );
}
