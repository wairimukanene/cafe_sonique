"use client";

import { useMemo, useState } from "react";

import { reconcileMpesaAction } from "@/app/dashboard/operations/actions";
import { OperationForm } from "./operation-form";

export function ReconciliationForm() {
  const [statement, setStatement] = useState("");
  const rows = useMemo(
    () =>
      statement
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [receiptNumber, amountKes, settledAt] = line.split(",").map((part) => part.trim());
          return { receiptNumber, amountKes, settledAt };
        }),
    [statement],
  );

  return (
    <OperationForm action={reconcileMpesaAction} submitLabel="Reconcile M-Pesa">
      <div className="dashboard-form-grid">
        <label>Period starts<input name="periodStart" required type="datetime-local" /></label>
        <label>Period ends<input name="periodEnd" required type="datetime-local" /></label>
      </div>
      <input name="rows" type="hidden" value={JSON.stringify(rows)} />
      <label>
        Statement rows
        <textarea
          aria-describedby="mpesa-format-help"
          onChange={(event) => setStatement(event.target.value)}
          placeholder={"QAB12C3DEF,1250,2026-10-10 09:30\nQAB98Z7YXW,450,2026-10-10 10:15"}
          required
          rows={9}
          value={statement}
        />
      </label>
      <p className="operations-muted" id="mpesa-format-help">
        Enter one transaction per line using REF,AMOUNT,YYYY-MM-DD HH:mm.
      </p>
    </OperationForm>
  );
}
