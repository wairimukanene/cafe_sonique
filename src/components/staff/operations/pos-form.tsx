"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";

import { completeSaleAction } from "@/app/dashboard/operations/actions";
import { OperationForm } from "./operation-form";

export type PosItem = {
  id: string;
  name: string;
  priceKes: number;
  available?: boolean;
};

export type LoyaltyOption = {
  id: string;
  label: string;
  points: number;
};

export function PosForm({
  items,
}: {
  items: PosItem[];
  loyaltyOptions?: LoyaltyOption[];
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [discountType, setDiscountType] = useState<"fixed_kes" | "percent">(
    "fixed_kes",
  );
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mpesa_buy_goods">(
    "cash",
  );
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIdempotencyKey(crypto.randomUUID()));
    return () => cancelAnimationFrame(frame);
  }, []);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.priceKes * (quantities[item.id] ?? 0),
        0,
      ),
    [items, quantities],
  );
  const discountKes =
    discountType === "percent"
      ? Math.min(subtotal, subtotal * (Math.min(discount, 100) / 100))
      : Math.min(subtotal, discount);
  const total = Math.max(0, subtotal - discountKes);
  const lineItems = items
    .filter((item) => (quantities[item.id] ?? 0) > 0)
    .map((item) => ({ menuItemId: item.id, quantity: quantities[item.id] }));

  function changeQuantity(id: string, delta: number) {
    setQuantities((current) => ({
      ...current,
      [id]: Math.max(0, (current[id] ?? 0) + delta),
    }));
  }

  return (
    <OperationForm action={completeSaleAction} submitLabel="Complete sale">
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <input name="items" type="hidden" value={JSON.stringify(lineItems)} />
      <input name="paymentAmountKes" type="hidden" value={Math.round(total)} />

      <fieldset className="operations-fieldset">
        <legend>1. Add items</legend>
        <div className="pos-menu">
          {items.map((item) => {
            const quantity = quantities[item.id] ?? 0;
            return (
              <article className="pos-menu-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>KES {item.priceKes.toLocaleString("en-KE")}</span>
                </div>
                <div className="quantity-control" aria-label={`${item.name} quantity`}>
                  <button
                    aria-label={`Remove one ${item.name}`}
                    disabled={!quantity}
                    onClick={() => changeQuantity(item.id, -1)}
                    type="button"
                  >
                    <Minus size={16} />
                  </button>
                  <output aria-live="polite">{quantity}</output>
                  <button
                    aria-label={`Add one ${item.name}`}
                    onClick={() => changeQuantity(item.id, 1)}
                    type="button"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </article>
            );
          })}
          {!items.length ? (
            <p className="operations-empty">No sale items are available.</p>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="operations-fieldset">
        <legend>2. Discount and payment</legend>
        <div className="dashboard-form-grid">
          <label>
            Discount type
            <select
              name="discountKind"
              onChange={(event) =>
                setDiscountType(event.target.value as "fixed_kes" | "percent")
              }
              value={discountType}
            >
              <option value="fixed_kes">Fixed amount (KES)</option>
              <option value="percent">Percentage</option>
            </select>
          </label>
          <label>
            Discount {discountType === "fixed_kes" ? "in KES" : "percentage"}
            <input
              max={discountType === "percent" ? 100 : undefined}
              min="0"
              name="discountValue"
              onChange={(event) => setDiscount(Number(event.target.value))}
              step={discountType === "percent" ? "0.01" : "1"}
              type="number"
              value={discount}
            />
          </label>
          <label>
            Payment method
            <select
              name="paymentMethod"
              onChange={(event) =>
                setPaymentMethod(
                  event.target.value as "cash" | "mpesa_buy_goods",
                )
              }
              value={paymentMethod}
            >
              <option value="cash">Cash</option>
              <option value="mpesa_buy_goods">M-Pesa</option>
            </select>
          </label>
          <label>
            Kenya phone (optional)
            <input
              autoComplete="tel"
              inputMode="tel"
              name="customerPhone"
              pattern="\+254[17]\d{8}"
              placeholder="+254712345678"
              type="tel"
            />
          </label>
        </div>
        {paymentMethod === "mpesa_buy_goods" ? (
          <label>
            M-Pesa receipt reference
            <input
              autoCapitalize="characters"
              name="mpesaReceiptNumber"
              placeholder="e.g. QAB12C3DEF"
              required
            />
          </label>
        ) : null}
      </fieldset>

      <fieldset className="operations-fieldset">
        <legend>3. Loyalty (optional)</legend>
        <label>
          Free drink to redeem
          <select name="loyaltyMenuItemId" defaultValue="">
            <option value="">No redemption</option>
            {items
              .filter((item) => (quantities[item.id] ?? 0) > 0)
              .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · KES {item.priceKes.toLocaleString("en-KE")}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <aside className="pos-total" aria-label="Sale total">
        <ShoppingBag aria-hidden size={22} />
        <div><span>Subtotal</span><strong>KES {subtotal.toLocaleString("en-KE")}</strong></div>
        <div><span>Discount</span><strong>− KES {discountKes.toLocaleString("en-KE")}</strong></div>
        <div className="pos-total-due"><span>Total due</span><strong>KES {total.toLocaleString("en-KE")}</strong></div>
      </aside>
    </OperationForm>
  );
}
