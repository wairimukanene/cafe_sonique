import Link from "next/link";
import { Plus } from "lucide-react";

import { voidSaleAction } from "@/app/dashboard/operations/actions";
import {
  dateTime,
  first,
  money,
  text,
} from "@/components/staff/operations/display";
import { OperationForm } from "@/components/staff/operations/operation-form";
import { requireStaff } from "@/lib/auth/session";
import { getSalesWorkspace } from "@/lib/operations/dal";
import "../operations/operations.css";

export const instant = false;

export default async function SalesPage() {
  const staff = await requireStaff();
  const workspace = await getSalesWorkspace();
  const sales = workspace.recentSales;

  return (
    <main className="dashboard-page operations-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Transaction history</p>
          <h1 className="dashboard-title">Sales</h1>
        </div>
        <Link className="staff-primary-button" href="/dashboard/sales/new">
          <Plus size={17} /> New sale
        </Link>
      </header>
      <section className="dashboard-panel operations-table-wrap">
        <table className="data-table">
          <thead><tr><th>When</th><th>Reference</th><th>Payment</th><th>Staff</th><th>Total</th><th>Status</th>{staff.user.role === "owner" ? <th>Action</th> : null}</tr></thead>
          <tbody>
            {sales.map((sale, index) => (
              <tr key={text(first(sale, ["id", "reference"]), String(index))}>
                <td>{dateTime(first(sale, ["completedAt", "createdAt", "soldAt"]))}</td>
                <td>{text(first(sale, ["receiptNumber", "reference", "id"]))}</td>
                <td>{sale.payments.map((payment) => payment.method).join(", ") || "—"}</td>
                <td>{sale.createdBy}</td>
                <td>{money(first(sale, ["totalKes", "total", "amountKes"]))}</td>
                <td><span className="status-pill">{text(first(sale, ["status"]))}</span></td>
                {staff.user.role === "owner" ? (
                  <td>
                    <OperationForm action={voidSaleAction} submitLabel="Void sale">
                      <input name="saleId" type="hidden" value={sale.id} />
                      <label>
                        Reason
                        <input name="reason" required />
                      </label>
                    </OperationForm>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {!sales.length ? <p className="operations-empty">No sales found.</p> : null}
      </section>
    </main>
  );
}
