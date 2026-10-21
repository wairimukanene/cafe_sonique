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

function LoyaltyProgress({
  balance,
  visitsRequired,
}: {
  balance: number;
  visitsRequired: number;
}) {
  const safeRequired = Math.max(1, visitsRequired);
  const filled = Math.max(0, balance);
  const ready = filled >= safeRequired;
  const shown = Math.min(filled, safeRequired);
  const percent = ready ? 100 : Math.round((shown / safeRequired) * 100);

  return (
    <div className="loyalty-progress">
      <div
        aria-label={
          ready
            ? "Next drink is free"
            : `${shown} of ${safeRequired} visits toward a free drink`
        }
        aria-valuemax={safeRequired}
        aria-valuemin={0}
        aria-valuenow={shown}
        className={ready ? "loyalty-progress-track is-ready" : "loyalty-progress-track"}
        role="progressbar"
      >
        <span className="loyalty-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p>
        {ready
          ? "Next drink is free"
          : `${safeRequired - shown} ${safeRequired - shown === 1 ? "visit" : "visits"} to a free drink`}
      </p>
    </div>
  );
}

export const instant = false;

export default async function LoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  await requireStaff();
  const query = await searchParams;
  const workspace = await getLoyaltyWorkspace(query.phone);
  const customer = workspace.customer as Record<string, unknown> | null;
  const customers = workspace.customers as Record<string, unknown>[];
  const visitsRequired = workspace.visitsRequired;

  return (
    <main className="dashboard-page operations-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Customer rewards</p>
          <h1 className="dashboard-title">Loyalty</h1>
        </div>
      </header>

      <section className="dashboard-panel mb-6">
        <p>
          A customer earns one visit each time they pay. After {visitsRequired} paid visits, the next drink is free. Only that one drink comes off the bill. Food, a second drink, or anything else on the order is still paid, and the free visit does not earn another stamp.
        </p>
      </section>

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

      {customer ? (
        <article className="dashboard-panel mb-6">
          <div className="mb-5 flex items-center gap-3">
            <Users size={19} />
            <div>
              <h2 className="font-display text-3xl">{text(first(customer, ["displayName", "phoneE164"]))}</h2>
              <p className="operations-muted">{text(first(customer, ["phoneE164"]))}</p>
            </div>
            <strong className="ml-auto">
              {text(first(customer, ["loyaltyBalance"]))} / {visitsRequired} visits
            </strong>
          </div>
          <LoyaltyProgress
            balance={Number(first(customer, ["loyaltyBalance"])) || 0}
            visitsRequired={visitsRequired}
          />
          <OperationForm action={adjustLoyaltyAction} submitLabel="Adjust visits">
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
      ) : null}

      {workspace.searched && !customer ? (
        <p className="dashboard-panel operations-empty mb-6">No customer matched that number.</p>
      ) : null}

      <section className="dashboard-panel">
        <h2 className="mb-4 font-display text-3xl">Customers</h2>
        {customers.length ? (
          <ul className="grid gap-3">
            {customers.map((row) => {
              const balance = Number(first(row, ["loyaltyBalance"])) || 0;
              return (
                <li className="loyalty-customer" key={text(first(row, ["id"]))}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{text(first(row, ["displayName"]), "Guest")}</p>
                      <p className="operations-muted">{text(first(row, ["phoneE164"]))}</p>
                    </div>
                    <p>
                      {balance} / {visitsRequired}
                    </p>
                  </div>
                  <LoyaltyProgress balance={balance} visitsRequired={visitsRequired} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="operations-empty">No loyalty customers yet. A visit is recorded when a sale includes a phone number.</p>
        )}
      </section>
    </main>
  );
}
