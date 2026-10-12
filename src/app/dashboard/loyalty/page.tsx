import { Search, Users } from "lucide-react";

import { adjustLoyaltyAction } from "@/app/dashboard/operations/actions";
import {
  first,
  text,
} from "@/components/staff/operations/display";
import { OperationForm } from "@/components/staff/operations/operation-form";
import { requireStaff } from "@/lib/auth/session";
import { getLoyaltyWorkspace } from "@/lib/operations/dal";
import "../operations/operations.css";

export const instant = false;

export default async function LoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  await requireStaff();
  const query = await searchParams;
  const workspace = await getLoyaltyWorkspace(query.phone);
  const workspaceRecord = workspace as unknown as Record<string, unknown>;
  const customers = workspace.customer ? [workspaceRecord.customer as Record<string, unknown>] : [];

  return (
    <main className="dashboard-page operations-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Customer rewards</p>
          <h1 className="dashboard-title">Loyalty</h1>
        </div>
      </header>

      <section className="dashboard-panel mb-6">
        <form className="dashboard-form" method="get">
          <label>
            Find by Kenya phone
            <input
              autoComplete="tel"
              defaultValue={query.phone}
              inputMode="tel"
              name="phone"
              pattern="(?:\+254|0)(?:7|1)\d{8}"
              placeholder="+254 7XX XXX XXX"
              type="tel"
            />
          </label>
          <button className="staff-secondary-button" type="submit"><Search size={17} /> Find customer</button>
        </form>
      </section>

      <div className="operations-grid">
        {customers.map((customer, index) => {
          const id = text(first(customer, ["id"]), String(index));
          return (
            <article className="dashboard-panel" key={id}>
              <div className="mb-5 flex items-center gap-3">
                <Users size={19} />
                <div>
                  <h2 className="font-display text-3xl">{text(first(customer, ["displayName", "phoneE164"]))}</h2>
                  <p className="operations-muted">{text(first(customer, ["phoneE164"]))}</p>
                </div>
                <strong className="ml-auto">{text(first(customer, ["loyaltyBalance"]))} visits</strong>
              </div>
              <OperationForm action={adjustLoyaltyAction} submitLabel="Adjust points">
                <input name="customerPhone" type="hidden" value={text(first(customer, ["phoneE164", "phone"]), "")} />
                <label>
                  Visit adjustment
                  <input name="visitDelta" required step="1" type="number" />
                </label>
                <p className="operations-muted">Use a positive number to add visits or a negative number to deduct them.</p>
                <label>
                  Note
                  <input name="note" required />
                </label>
              </OperationForm>
            </article>
          );
        })}
        {!customers.length ? <p className="dashboard-panel operations-empty">No loyalty customers found.</p> : null}
      </div>
    </main>
  );
}
