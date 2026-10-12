import {
  PosForm,
  type PosItem,
} from "@/components/staff/operations/pos-form";
import { requireStaff } from "@/lib/auth/session";
import { getSalesWorkspace } from "@/lib/operations/dal";
import "../../operations/operations.css";

export const instant = false;

export default async function NewSalePage() {
  await requireStaff();
  const workspace = await getSalesWorkspace();
  const items: PosItem[] = workspace.menu
    .flatMap((category) => category.items)
    .map((item) => ({
      id: item.id,
      name: item.name,
      priceKes: item.priceKes,
      available: item.available,
    }))
    .filter(
      (item) =>
        Number.isFinite(item.priceKes) && item.available,
    );

  return (
    <main className="dashboard-page operations-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Point of sale</p>
          <h1 className="dashboard-title">New sale</h1>
        </div>
      </header>
      <section className="dashboard-panel">
        <PosForm items={items} />
      </section>
    </main>
  );
}
