import { Bike, CircleAlert, CircleCheck, Plus, WalletCards } from "lucide-react";

import { ProductForm } from "@/components/admin/product-form";
import { ActionForm } from "@/components/staff/action-form";
import { requireStaff } from "@/lib/auth/session";
import { getStaffDeliveryAreas, getStaffShopProducts } from "@/lib/shop/dal";
import { getMpesaStatus } from "@/lib/shop/mpesa";
import { saveShopDeliveryArea } from "./actions";

export const instant = false;

const modeLabels = {
  off: "Switched off",
  mock: "Practice mode (no real money)",
  sandbox: "Safaricom test mode (no real money)",
  production: "Live",
} as const;

export default async function ShopEditorPage() {
  const session = await requireStaff();
  const isOwner = session.user.role === "owner";
  const [products, areas] = await Promise.all([getStaffShopProducts(), getStaffDeliveryAreas()]);
  const mpesa = getMpesaStatus();

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Public website</p>
          <h1 className="dashboard-title">Shop</h1>
        </div>
        <a className="staff-secondary-button" href="/shop" target="_blank" rel="noreferrer">
          View shop
        </a>
      </header>

      <section className="dashboard-panel mb-6 flex flex-wrap items-start gap-4">
        <WalletCards size={22} className="mt-1" />
        <div className="flex-1">
          <h2 className="font-display text-2xl">M-Pesa payments</h2>
          <p className="mt-1 flex items-center gap-2 text-sm">
            {mpesa.ready ? (
              <CircleCheck size={16} className="text-olive" />
            ) : (
              <CircleAlert size={16} className="text-rust" />
            )}
            {modeLabels[mpesa.mode]}
            {mpesa.ready && mpesa.tillNumber ? ` · paying into till ${mpesa.tillNumber}` : ""}
          </p>
          {mpesa.problem ? <p className="mt-2 text-sm text-ink/60">{mpesa.problem}</p> : null}
          <p className="mt-2 text-xs text-ink/45">
            Safaricom keys are kept on the server, not in this editor. Ask your developer to change them.
          </p>
        </div>
      </section>

      {isOwner ? (
        <details className="dashboard-panel mb-6">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold">
            <Plus size={18} /> Add a product
          </summary>
          <div className="mt-6">
            <ProductForm isOwner />
          </div>
        </details>
      ) : (
        <p className="mb-6 max-w-2xl text-sm leading-6 text-ink/60">
          You can update product names, descriptions and photos. Prices, stock and new products are managed by the
          owner.
        </p>
      )}

      <div className="mb-12 grid gap-4">
        {products.map((product) => {
          const stock = product.options.reduce((sum, option) => sum + option.stock, 0);
          return (
            <details className="dashboard-panel" key={product.id}>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-4">
                <span>
                  <strong className="font-display text-2xl">{product.name}</strong>
                  <small className="ml-3 text-ink/45">KES {product.priceKes.toLocaleString("en-KE")}</small>
                </span>
                <span className="flex flex-wrap gap-2">
                  {product.featured ? <span className="status-pill">Homepage</span> : null}
                  <span className="status-pill">{product.active ? `${stock} in stock` : "Hidden"}</span>
                </span>
              </summary>
              <div className="mt-6">
                <ProductForm
                  isOwner={isOwner}
                  product={{
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    priceKes: product.priceKes,
                    imagePath: product.imagePath,
                    imageAlt: product.imageAlt,
                    featured: product.featured,
                    active: product.active,
                    sortOrder: product.sortOrder,
                    colours: product.colours.map((colour) => ({
                      id: colour.id,
                      name: colour.name,
                      imagePath: colour.imagePath,
                      imageAlt: colour.imageAlt,
                    })),
                    options: product.options.map((option) => ({
                      id: option.id,
                      colourId: option.colourId,
                      label: option.label,
                      stock: option.stock,
                    })),
                  }}
                />
              </div>
            </details>
          );
        })}
        {!products.length ? <p className="text-sm text-ink/55">No products yet.</p> : null}
      </div>

      <section>
        <h2 className="eyebrow mb-4 flex items-center gap-2 text-olive">
          <Bike size={16} /> Delivery areas
        </h2>
        {isOwner ? (
          <div className="grid gap-4">
            {areas.map((area) => (
              <details className="dashboard-panel" key={area.id}>
                <summary className="flex cursor-pointer items-center justify-between gap-4">
                  <span>
                    <strong>{area.name}</strong>
                    <small className="ml-3 text-ink/45">KES {area.feeKes.toLocaleString("en-KE")}</small>
                  </span>
                  <span className="status-pill">{area.active ? "Available" : "Off"}</span>
                </summary>
                <ActionForm action={saveShopDeliveryArea} className="mt-5">
                  <input name="id" type="hidden" value={area.id} />
                  <DeliveryAreaFields area={area} />
                </ActionForm>
              </details>
            ))}
            <details className="dashboard-panel">
              <summary className="flex cursor-pointer items-center gap-2 font-semibold">
                <Plus size={18} /> Add a delivery area
              </summary>
              <ActionForm action={saveShopDeliveryArea} className="mt-5" submitLabel="Add area">
                <DeliveryAreaFields />
              </ActionForm>
            </details>
          </div>
        ) : (
          <ul className="dashboard-panel grid gap-2 text-sm">
            {areas
              .filter((area) => area.active)
              .map((area) => (
                <li key={area.id} className="flex justify-between">
                  <span>{area.name}</span>
                  <span>KES {area.feeKes.toLocaleString("en-KE")}</span>
                </li>
              ))}
            {!areas.some((area) => area.active) ? <li className="text-ink/55">No delivery areas yet.</li> : null}
          </ul>
        )}
      </section>
    </main>
  );
}

function DeliveryAreaFields({
  area,
}: {
  area?: { name: string; feeKes: number; sortOrder: number; active: boolean };
}) {
  return (
    <>
      <div className="dashboard-form-grid">
        <label>
          Area name
          <input name="name" defaultValue={area?.name} placeholder="e.g. Westlands & Parklands" maxLength={80} required />
        </label>
        <label>
          Delivery fee in KES
          <input name="feeKes" type="number" min="0" defaultValue={area?.feeKes} required />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-6 text-sm">
        <label className="check-field">
          <input className="h-4 w-4" name="active" type="checkbox" defaultChecked={area?.active ?? true} />
          Available at checkout
        </label>
        <label className="w-28">
          Display order
          <input name="sortOrder" type="number" min="0" defaultValue={area?.sortOrder ?? 0} />
        </label>
      </div>
    </>
  );
}
