import Link from "next/link";

import { CsvDownload } from "@/components/staff/operations/csv-download";
import {
  first,
  money,
  records,
  text,
  type DisplayRecord,
} from "@/components/staff/operations/display";
import { requireOwner } from "@/lib/auth/session";
import { getReportsData } from "@/lib/operations/dal";
import "../operations/operations.css";

export const instant = false;

type ReportPeriod = "daily" | "weekly" | "monthly" | "custom";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  await requireOwner();
  const query = await searchParams;
  const period: ReportPeriod =
    query.period === "weekly" || query.period === "monthly" ||
    (query.period === "custom" && query.from && query.to)
      ? query.period
      : "daily";
  const data = await getReportsData({
    period,
    start: period === "custom" ? new Date(`${query.from}T00:00:00+03:00`) : undefined,
    end: period === "custom" ? new Date(`${query.to}T00:00:00+03:00`) : undefined,
  });
  const root = (data ?? {}) as DisplayRecord;
  const salesSummary = root.sales as DisplayRecord;
  const expenseSummary = root.expenses as DisplayRecord;
  const loyaltySummary = root.loyalty as DisplayRecord;
  const reconciliationSummary = root.reconciliation as DisplayRecord;
  const products = records(data, ["products", "productSummary", "topProducts"]);
  const payments = records(data, ["payments", "paymentSummary"]);
  const csvRows = [
    ...products.map((product) => ({
      section: "product",
      name: text(first(product, ["name", "productName"])),
      quantity: text(first(product, ["quantity", "unitsSold"]), ""),
      amountKes: text(first(product, ["grossKes"]), ""),
    })),
    ...payments.map((payment) => ({
      section: "payment",
      name: text(first(payment, ["method", "paymentMethod", "name"])),
      quantity: text(first(payment, ["count", "transactions"]), ""),
      amountKes: text(first(payment, ["amountKes", "totalKes"]), ""),
    })),
  ];

  const cards = [
    ["Gross sales", first(salesSummary, ["grossKes"])],
    ["Discounts", first(salesSummary, ["discountsKes"])],
    ["Expenses", first(expenseSummary, ["totalKes"])],
    ["Net after expenses", root.netAfterExpensesKes],
    ["Loyalty rewards", first(loyaltySummary, ["costKes"])],
    ["M-Pesa difference", first(reconciliationSummary, ["differenceKes"])],
  ] as const;

  return (
    <main className="dashboard-page operations-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Owner only</p>
          <h1 className="dashboard-title">Reports</h1>
        </div>
        <CsvDownload filename={`sonique-${period}-report.csv`} rows={csvRows} />
      </header>

      <section className="dashboard-panel mb-6">
        <nav className="period-filters mb-5" aria-label="Report period">
          {(["daily", "weekly", "monthly"] as const).map((value) => (
            <Link href={`/dashboard/reports?period=${value}`} key={value}>{value}</Link>
          ))}
        </nav>
        <form className="dashboard-form" method="get">
          <input name="period" type="hidden" value="custom" />
          <div className="dashboard-form-grid">
            <label>Custom period starts<input defaultValue={query.from} name="from" required type="date" /></label>
            <label>Custom period ends<input defaultValue={query.to} name="to" required type="date" /></label>
          </div>
          <button className="staff-secondary-button" type="submit">Apply custom period</button>
        </form>
      </section>

      <section className="dashboard-stats mb-6" aria-label="Report summary">
        {cards.map(([label, value]) => (
          <article className="stat-card" key={label}>
            <span>{label}</span>
            <strong className="!text-4xl">{money(value)}</strong>
            <span>{period} period</span>
          </article>
        ))}
      </section>

      <div className="operations-grid">
        <ReportTable heading="Product summary" rows={products} kind="product" />
        <ReportTable heading="Payment summary" rows={payments} kind="payment" />
      </div>
    </main>
  );
}

function ReportTable({
  heading,
  rows,
  kind,
}: {
  heading: string;
  rows: DisplayRecord[];
  kind: "product" | "payment";
}) {
  return (
    <section className="dashboard-panel operations-table-wrap">
      <h2 className="mb-4 font-display text-3xl">{heading}</h2>
      <table className="data-table">
        <thead><tr><th>{kind === "product" ? "Product" : "Method"}</th><th>{kind === "product" ? "Quantity" : "Transactions"}</th><th>Total</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={text(first(row, ["id", "name", "method"]), String(index))}>
              <td>{text(first(row, kind === "product" ? ["name", "productName"] : ["method", "paymentMethod", "name"]))}</td>
              <td>{text(first(row, kind === "product" ? ["quantity", "unitsSold"] : ["count", "transactions"]))}</td>
              <td>{money(first(row, ["grossKes", "amountKes", "totalKes"]))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="operations-empty">No report data for this period.</p> : null}
    </section>
  );
}
