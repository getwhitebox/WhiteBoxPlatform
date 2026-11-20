// Settings → Customer categories (admins only).
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { listCategoriesWithCounts } from "@/server/categories";
import { canManageSettings } from "@/server/permissions";
import { Badge, btn, Card, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/inline-forms";
import { addCategoryAction, archiveCategoryAction, renameCategoryAction } from "./actions";
import { AddCategoryForm, RenameCategoryForm } from "./category-forms";

export default async function CategoriesPage() {
  const session = await requireSession();
  if (!canManageSettings(session)) redirect("/");
  const categories = await listCategoriesWithCounts(session);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customer categories"
        subtitle={`Used to group and filter customers at ${session.company.name}.`}
      />
      <Card>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              {c.archivedAt ? (
                <span className="flex-1 text-sm text-zinc-500 line-through dark:text-zinc-400">{c.name}</span>
              ) : (
                <RenameCategoryForm action={renameCategoryAction.bind(null, c.id)} name={c.name} />
              )}
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {c._count.customers} {c._count.customers === 1 ? "customer" : "customers"}
              </span>
              {c.archivedAt ? (
                <>
                  <Badge>Retired</Badge>
                  <ConfirmButton
                    action={archiveCategoryAction.bind(null, c.id, false)}
                    label="Bring back"
                    confirm={`Bring back "${c.name}"?`}
                    className={btn.secondary}
                  />
                </>
              ) : (
                <ConfirmButton
                  action={archiveCategoryAction.bind(null, c.id, true)}
                  label="Retire"
                  confirm={`Retire "${c.name}"? Existing customers keep it, but it won't be offered for new customers.`}
                  className={btn.secondary}
                />
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <AddCategoryForm action={addCategoryAction} />
        </div>
      </Card>
    </div>
  );
}
