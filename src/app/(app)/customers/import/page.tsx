import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { listCategories } from "@/server/customers";
import { canEditCustomers } from "@/server/permissions";
import { PageHeader } from "@/components/ui";
import { ImportWizard } from "./import-wizard";

export default async function ImportPage() {
  const session = await requireSession();
  if (!canEditCustomers(session)) redirect("/customers");
  const categories = await listCategories(session);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Import customers from Square"
        subtitle="Only new customers are added. Anyone already here (same Square ID, email or phone) is skipped."
        back={{ href: "/customers", label: "Customers" }}
      />
      <ImportWizard categories={categories} />
    </div>
  );
}
