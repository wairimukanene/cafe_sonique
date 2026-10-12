import { ReceiptText } from "lucide-react";

import {
  recordExpenseAction,
  voidExpenseAction,
} from "@/app/dashboard/operations/actions";
import {
  dateTime,
  first,
  money,
  text,
} from "@/components/staff/operations/display";
import { OperationForm } from "@/components/staff/operations/operation-form";
import { requireStaff } from "@/lib/auth/session";
import { getExpenseWorkspace } from "@/lib/operations/dal";
import "../operations/operations.css";

export const instant = false;

export default async function ExpensesPage() {
  const staff = await requireStaff();
  const workspace = await getExpenseWorkspace();
  const expenses = workspace.expenses;
  const categories = workspace.categories;

  return (
    <main className="dashboard-page operations-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Cash out</p>
          <h1 className="dashboard-title">Expenses</h1>
        </div>
      </header>

      <details className="dashboard-panel mb-6" open={!expenses.length}>
        <summary className="flex cursor-pointer items-center gap-2 font-semibold">
          <ReceiptText size={18} /> Record expense
        </summary>
        <OperationForm
          action={recordExpenseAction}
          className="mt-6"
          encType="multipart/form-data"
          submitLabel="Record expense"
        >
          <div className="dashboard-form-grid">
            <label>
              Description
              <input name="description" required />
            </label>
            <label>
              Amount in KES
              <input min="1" name="amountKes" required step="1" type="number" />
            </label>
            <label>
              Category
              <select name="categoryId" required>
                <option value="">Select category</option>
                {categories.map((category, index) => (
                  <option key={text(first(category, ["id"]), String(index))} value={text(first(category, ["id", "value"]), "")}>
                    {text(first(category, ["name", "label"]))}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Expense date
              <input name="incurredAt" required type="datetime-local" />
            </label>
            <label>
              Payment method
              <select name="paymentMethod" required>
                <option value="">Select method</option>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
              </select>
            </label>
            <label>
              Receipt (optional)
              <input accept="image/*,.pdf" name="receipt" type="file" />
            </label>
          </div>
          <label>
            Payee (optional)
            <input name="payee" />
          </label>
        </OperationForm>
      </details>

      <section className="dashboard-panel operations-table-wrap">
        <table className="data-table">
          <thead><tr><th>When</th><th>Description</th><th>Category</th><th>Payment</th><th>Amount</th><th>Action</th></tr></thead>
          <tbody>
            {expenses.map((expense, index) => {
              const id = text(first(expense, ["id"]), String(index));
              const status = text(first(expense, ["status"]), "");
              return (
                <tr key={id}>
                  <td>{dateTime(first(expense, ["expenseDate", "occurredAt", "createdAt"]))}</td>
                  <td>
                    {text(first(expense, ["description", "name"]))}
                    {Array.isArray(expense.receipts) && expense.receipts[0] ? (
                      <a
                        className="ml-2 underline"
                        href={`/api/operations/receipts/${String((expense.receipts[0] as Record<string, unknown>).id)}`}
                        target="_blank"
                      >
                        Receipt
                      </a>
                    ) : null}
                  </td>
                  <td>{expense.category?.name ?? "—"}</td>
                  <td>{text(first(expense, ["paymentMethod"]))}</td>
                  <td>{money(first(expense, ["amountKes", "amount"]))}</td>
                  <td>
                    {status !== "void" && staff.user.role === "owner" ? (
                      <OperationForm action={voidExpenseAction} submitLabel="Void">
                        <input name="expenseId" type="hidden" value={id} />
                        <label>
                          Void reason
                          <input name="reason" required />
                        </label>
                      </OperationForm>
                    ) : <span className="status-pill">{status}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!expenses.length ? <p className="operations-empty">No expenses found.</p> : null}
      </section>
    </main>
  );
}
