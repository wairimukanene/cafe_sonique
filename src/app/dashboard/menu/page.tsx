import { Plus, UtensilsCrossed } from "lucide-react";

import { ActionForm } from "@/components/staff/action-form";
import { getStaffMenu } from "@/lib/dal/content";
import { saveMenuItem } from "../actions";

export const instant = false;

export default async function MenuManagementPage() {
  const categories = await getStaffMenu();

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Public content</p>
          <h1 className="dashboard-title">Menu</h1>
        </div>
      </header>

      <details className="dashboard-panel mb-6">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold">
          <Plus size={18} /> Add a menu item
        </summary>
        <ActionForm action={saveMenuItem} className="mt-6" submitLabel="Add item">
          <MenuFields categories={categories} />
        </ActionForm>
      </details>

      <div className="grid gap-4">
        {categories.map((category) => (
          <section className="dashboard-panel" key={category.id}>
            <div className="mb-5 flex items-center gap-3">
              <UtensilsCrossed size={18} />
              <h2 className="font-display text-3xl">{category.name}</h2>
              <span className="ml-auto text-xs text-ink/45">{category.items.length} items</span>
            </div>
            <div className="grid gap-3">
              {category.items.map((item) => (
                <details className="border-t border-ink/10 pt-4" key={item.id}>
                  <summary className="flex cursor-pointer items-center justify-between gap-4 pb-3">
                    <span>
                      <strong>{item.name}</strong>
                      <small className="ml-3 text-ink/45">KES {item.priceKes}</small>
                    </span>
                    <span className="status-pill">{item.available ? "Available" : "Sold out"}</span>
                  </summary>
                  <ActionForm action={saveMenuItem} className="pb-4">
                    <input name="id" type="hidden" value={item.id} />
                    <MenuFields categories={categories} item={item} />
                  </ActionForm>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

type Category = Awaited<ReturnType<typeof getStaffMenu>>[number];
type Item = Category["items"][number];

function MenuFields({
  categories,
  item,
}: {
  categories: Category[];
  item?: Item;
}) {
  return (
    <>
      <div className="dashboard-form-grid">
        <label>
          Category
          <select name="categoryId" defaultValue={item?.categoryId ?? categories[0]?.id} required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>
          Item name
          <input name="name" defaultValue={item?.name} required />
        </label>
      </div>
      <label>
        Description
        <input name="description" defaultValue={item?.description} required />
      </label>
      <div className="dashboard-form-grid">
        <label>
          Price in KES
          <input name="priceKes" type="number" min="0" defaultValue={item?.priceKes} required />
        </label>
        <label>
          Display order
          <input name="sortOrder" type="number" min="0" defaultValue={item?.sortOrder ?? 0} />
        </label>
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="check-field">
          <input className="h-4 w-4" name="available" type="checkbox" defaultChecked={item?.available ?? true} />
          Available
        </label>
        <label className="check-field">
          <input className="h-4 w-4" name="active" type="checkbox" defaultChecked={item?.active ?? true} />
          Published
        </label>
      </div>
    </>
  );
}
