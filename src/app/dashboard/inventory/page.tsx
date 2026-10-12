import { AlertTriangle, Boxes, FlaskConical, MoveDown } from "lucide-react";

import {
  recordInventoryMovementAction,
  saveInventoryItemAction,
} from "@/app/dashboard/operations/actions";
import {
  first,
  records,
  text,
} from "@/components/staff/operations/display";
import { OperationForm } from "@/components/staff/operations/operation-form";
import { RecipeForm } from "@/components/staff/operations/recipe-form";
import { requireStaff } from "@/lib/auth/session";
import { getInventoryWorkspace, getSalesWorkspace } from "@/lib/operations/dal";
import "../operations/operations.css";

export const instant = false;

export default async function InventoryPage() {
  const staff = await requireStaff();
  const [workspace, salesWorkspace] = await Promise.all([
    getInventoryWorkspace(),
    getSalesWorkspace(),
  ]);
  const items = records(workspace, ["items", "inventoryItems"]);
  const lowStock = records(workspace, ["lowStock", "lowStockItems"]);
  const recipeItems = salesWorkspace.menu.flatMap((category) => category.items);
  const movements = records(workspace, ["movements", "recentMovements"]);

  return (
    <main className="dashboard-page operations-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Stock control</p>
          <h1 className="dashboard-title">Inventory</h1>
        </div>
      </header>

      <section className="dashboard-panel mb-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="text-rust" size={19} />
          <h2 className="font-display text-3xl">Low stock</h2>
        </div>
        <div className="operations-grid">
          {lowStock.map((item, index) => (
            <article className="operations-card !min-h-0" key={text(first(item, ["id"]), String(index))}>
              <strong>{text(first(item, ["name"]))}</strong>
              <p>
                {text(first(item, ["onHand"]))} {text(first(item, ["unit"]), "")}
                {" "}remaining · threshold {text(first(item, ["lowStockThreshold", "reorderLevel", "threshold"]))}
              </p>
            </article>
          ))}
          {!lowStock.length ? <p className="operations-muted">No low-stock items.</p> : null}
        </div>
      </section>

      <div className="operations-grid mb-6">
        {staff.user.role === "owner" ? <details className="dashboard-panel">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold"><Boxes size={18} /> Add or update item</summary>
          <OperationForm action={saveInventoryItemAction} className="mt-6" submitLabel="Save item">
            <label>Existing item (optional)<select name="id" defaultValue=""><option value="">New item</option>{items.map(option)}</select></label>
            <label>Item name<input name="name" required /></label>
            <div className="dashboard-form-grid">
              <label>Unit<input name="unit" placeholder="kg, litre, each" required /></label>
              <label>Reorder level<input min="0" name="reorderLevel" required step="0.001" type="number" /></label>
            </div>
            <label>SKU (optional)<input name="sku" /></label>
            <label className="check-field"><input defaultChecked name="active" type="checkbox" /> Active</label>
          </OperationForm>
        </details> : null}

        <details className="dashboard-panel">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold"><MoveDown size={18} /> Record movement</summary>
          <OperationForm action={recordInventoryMovementAction} className="mt-6" submitLabel="Record movement">
            <label>Inventory item<select name="inventoryItemId" required><option value="">Select item</option>{items.map(option)}</select></label>
            <div className="dashboard-form-grid">
              <label>Movement reason<select name="reason" required><option value="">Select reason</option><option value="purchase">Purchase</option>{staff.user.role === "owner" ? <option value="adjustment">Adjustment</option> : null}<option value="waste">Waste</option><option value="count">Stock count</option></select></label>
              <label>Quantity<input name="quantity" required step="0.001" type="number" /></label>
            </div>
            <label>Note (optional)<input name="note" /></label>
          </OperationForm>
        </details>

        {staff.user.role === "owner" ? <details className="dashboard-panel">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold"><FlaskConical size={18} /> Save recipe ingredient</summary>
          <RecipeForm
            inventoryItems={items.map(toOption).filter((item) => item.id && item.name)}
            menuItems={recipeItems.map((item) => ({ id: item.id, name: item.name }))}
          />
        </details> : null}
      </div>

      <section className="dashboard-panel operations-table-wrap">
        <h2 className="mb-4 font-display text-3xl">Recent movements</h2>
        <table className="data-table">
          <thead><tr><th>Item</th><th>Type</th><th>Quantity</th><th>Reason</th></tr></thead>
          <tbody>
            {movements.map((movement, index) => (
              <tr key={text(first(movement, ["id"]), String(index))}>
                <td>{text(first(movement, ["itemName", "inventoryItemName", "name"]))}</td>
                <td>{text(first(movement, ["type", "movementType"]))}</td>
                <td>{text(first(movement, ["delta"]))}</td>
                <td>{text(first(movement, ["reason", "note"]))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!movements.length ? <p className="operations-empty">No inventory movements found.</p> : null}
      </section>
    </main>
  );
}

function option(item: Record<string, unknown>, index: number) {
  const id = text(first(item, ["id"]), String(index));
  return <option key={id} value={id}>{text(first(item, ["name", "label"]))}</option>;
}

function toOption(item: Record<string, unknown>) {
  return { id: text(first(item, ["id"]), ""), name: text(first(item, ["name"]), "") };
}
