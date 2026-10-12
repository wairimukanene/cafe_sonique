import {
  AlertTriangle,
  Banknote,
  CreditCard,
  Eye,
  Gift,
  ReceiptText,
  ShoppingBag,
} from "lucide-react";

import { getDailyOperationsSummary } from "@/lib/operations/dal";

export const instant = false;

export default async function DashboardPage() {
  const summary = await getDailyOperationsSummary();

  const stats = [
    { label: "Sales today", value: `KES ${summary.salesKes.toLocaleString("en-KE")}`, icon: ShoppingBag },
    { label: "Transactions", value: summary.salesCount, icon: ReceiptText },
    { label: "Cash collected", value: `KES ${summary.cashKes.toLocaleString("en-KE")}`, icon: Banknote },
    { label: "M-Pesa collected", value: `KES ${summary.mpesaKes.toLocaleString("en-KE")}`, icon: CreditCard },
    { label: "Expenses today", value: `KES ${summary.expensesKes.toLocaleString("en-KE")}`, icon: AlertTriangle },
    { label: "Rewards redeemed", value: summary.loyaltyRewards, icon: Gift },
  ];

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Today at Sonique</p>
          <h1 className="dashboard-title">Overview</h1>
        </div>
        <a className="staff-secondary-button" href="/" target="_blank">
          <Eye size={17} /> View public site
        </a>
      </header>
      <section className="dashboard-stats" aria-label="Content summary">
        {stats.map(({ label, value, icon: Icon }) => (
          <article className="stat-card" key={label}>
            <Icon size={22} />
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </section>
      <section className="dashboard-panel mt-8">
        <p className="eyebrow text-olive">Stock attention</p>
        <h2 className="mt-3 font-display text-4xl">
          {summary.lowStockItems.length} low-stock item{summary.lowStockItems.length === 1 ? "" : "s"}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/60">
          {summary.lowStockItems.length
            ? summary.lowStockItems.map((item) => item.name).join(", ")
            : "All active inventory items are above their reorder levels."}
        </p>
      </section>
    </main>
  );
}
