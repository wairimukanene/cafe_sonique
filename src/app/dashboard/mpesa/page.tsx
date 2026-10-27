import { RefreshCcw } from "lucide-react";

import {
  dateTime,
  first,
  money,
  records,
  text,
} from "@/components/staff/operations/display";
import { ReconciliationForm } from "@/components/staff/operations/reconciliation-form";
import { requireOwner } from "@/lib/auth/session";
import { getReconciliationWorkspace } from "@/lib/operations/dal";
import "../operations/operations.css";

export const instant = false;

export default async function MpesaPage() {
  await requireOwner();
  const workspace = await getReconciliationWorkspace();
  const rows = records(workspace, ["unreconciledPayments"]);
  const sessions = records(workspace, ["sessions"]);

  return (
    <main className="dashboard-page operations-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Owner only</p>
          <h1 className="dashboard-title">M-Pesa</h1>
        </div>
      </header>

      <section className="dashboard-panel mb-6">
        <div className="mb-5 flex items-center gap-2">
          <RefreshCcw size={18} />
          <h2 className="font-display text-3xl">Reconcile receipts</h2>
        </div>
        <ReconciliationForm />
      </section>

      <section className="dashboard-panel operations-table-wrap">
        <table className="data-table">
          <thead><tr><th>When</th><th>Receipt</th><th>Till</th><th>Amount</th></tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={text(first(row, ["paymentId", "id", "reference"]), String(index))}>
                <td>{dateTime(first(row, ["recordedAt", "transactedAt", "createdAt"]))}</td>
                <td>{text(first(row, ["receiptNumber", "receiptRef", "reference", "mpesaReceiptRef"]))}</td>
                <td>{text(first(row, ["tillNumber"]))}</td>
                <td>{money(first(row, ["amountKes"]))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="operations-empty">No reconciliation records found.</p> : null}
      </section>

      <section className="dashboard-panel operations-table-wrap mt-6">
        <h2 className="mb-4 font-display text-3xl">Reconciliation history</h2>
        <table className="data-table">
          <thead><tr><th>Created</th><th>Period</th><th>Expected</th><th>Statement</th><th>Difference</th></tr></thead>
          <tbody>
            {sessions.map((session, index) => (
              <tr key={text(first(session, ["id"]), String(index))}>
                <td>{dateTime(first(session, ["createdAt"]))}</td>
                <td>{dateTime(first(session, ["periodStart"]))} – {dateTime(first(session, ["periodEnd"]))}</td>
                <td>{money(first(session, ["expectedKes"]))}</td>
                <td>{money(first(session, ["settlementKes"]))}</td>
                <td>{money(first(session, ["differenceKes"]))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sessions.length ? <p className="operations-empty">No reconciliation sessions found.</p> : null}
      </section>
    </main>
  );
}
