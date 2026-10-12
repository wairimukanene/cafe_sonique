import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  ChartNoAxesCombined,
  CreditCard,
  ReceiptText,
  ScanLine,
  Users,
} from "lucide-react";

import { OperationForm } from "@/components/staff/operations/operation-form";
import { requireStaff } from "@/lib/auth/session";
import { getOperationsSettings } from "@/lib/operations/dal";
import { saveOperationsSettingsAction } from "./actions";

export const instant = false;

const workspaces = [
  { href: "/dashboard/sales/new", label: "New sale", description: "Open the point of sale.", icon: ScanLine },
  { href: "/dashboard/sales", label: "Sales", description: "Review completed transactions.", icon: BadgeDollarSign },
  { href: "/dashboard/expenses", label: "Expenses", description: "Record and review spend.", icon: ReceiptText },
  { href: "/dashboard/loyalty", label: "Loyalty", description: "Look up and adjust customer points.", icon: Users },
  { href: "/dashboard/inventory", label: "Inventory", description: "Track stock, movements, and recipes.", icon: Boxes },
] as const;

export default async function OperationsPage() {
  const session = await requireStaff();
  const settings =
    session.user.role === "owner" ? await getOperationsSettings() : null;
  const ownerWorkspaces =
    session.user.role === "owner"
      ? [
          { href: "/dashboard/mpesa", label: "M-Pesa", description: "Reconcile receipt records.", icon: CreditCard },
          { href: "/dashboard/reports", label: "Reports", description: "Review operational performance.", icon: ChartNoAxesCombined },
        ]
      : [];
  const values = (settings ?? {}) as Record<string, unknown>;

  return (
    <main className="dashboard-page operations-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Operations core</p>
          <h1 className="dashboard-title">Today&apos;s work</h1>
        </div>
      </header>

      <section className="operations-grid operations-grid-wide" aria-label="Operations workspaces">
        {[...workspaces, ...ownerWorkspaces].map(({ href, label, description, icon: Icon }) => (
          <Link className="operations-card operations-card-link" href={href} key={href}>
            <Icon aria-hidden size={21} />
            <span><strong>{label}</strong><p>{description}</p></span>
            <ArrowRight aria-hidden size={17} />
          </Link>
        ))}
      </section>

      {session.user.role === "owner" ? (
        <details className="dashboard-panel mt-6">
          <summary className="cursor-pointer font-semibold">Operations settings</summary>
          <OperationForm
            action={saveOperationsSettingsAction}
            className="mt-6"
            submitLabel="Save settings"
          >
            <div className="dashboard-form-grid">
              <label>
                M-Pesa till number
                <input
                  defaultValue={String(values.tillNumber ?? "")}
                  name="tillNumber"
                  required
                />
              </label>
              <label>
                Visits required for reward
                <input
                  defaultValue={String(values.loyaltyVisitsRequired ?? "")}
                  min="1"
                  name="loyaltyVisitsRequired"
                  type="number"
                  required
                />
              </label>
              <label>
                Loyalty reward cap in KES
                <input
                  defaultValue={String(values.loyaltyRewardCapKes ?? "")}
                  min="1"
                  name="loyaltyRewardCapKes"
                  type="number"
                  required
                />
              </label>
            </div>
          </OperationForm>
        </details>
      ) : null}
    </main>
  );
}
