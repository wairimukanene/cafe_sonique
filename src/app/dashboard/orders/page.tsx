import Link from "next/link";
import { Bike, CircleAlert, Phone, Store } from "lucide-react";

import { ActionForm } from "@/components/staff/action-form";
import { requireStaff } from "@/lib/auth/session";
import { getStaffOrders, orderTabs, type OrderTabKey } from "@/lib/shop/dal";
import { orderStatusLabels, paymentFailureMessage, type ShopOrderStatus } from "@/lib/shop/domain";
import { releaseExpiredHolds } from "@/lib/shop/service";
import { advanceShopOrder, cancelShopOrder } from "./actions";

export const instant = false;

const nextStep: Partial<Record<ShopOrderStatus, { pickup?: [ShopOrderStatus, string]; delivery?: [ShopOrderStatus, string] }>> = {
  paid: {
    pickup: ["ready_for_pickup", "Packed – ready for pickup"],
    delivery: ["out_for_delivery", "Handed to the rider"],
  },
  ready_for_pickup: { pickup: ["completed", "Customer collected it"] },
  out_for_delivery: { delivery: ["completed", "Delivered"] },
};

const time = (date: Date) =>
  date.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" });

export default async function OnlineOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireStaff();
  const isOwner = session.user.role === "owner";
  const query = await searchParams;
  const tab = (orderTabs.find((item) => item.key === query.tab)?.key ?? "to-pack") as OrderTabKey;
  await releaseExpiredHolds();
  const { orders, countByTab } = await getStaffOrders(tab);

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Shop</p>
          <h1 className="dashboard-title">Online orders</h1>
        </div>
      </header>

      <nav className="order-tabs" aria-label="Order stages">
        {orderTabs.map((item) => (
          <Link
            key={item.key}
            href={`/dashboard/orders?tab=${item.key}`}
            aria-current={item.key === tab ? "page" : undefined}
          >
            {item.label}
            {countByTab[item.key] ? <span>{countByTab[item.key]}</span> : null}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4">
        {orders.map((order) => {
          const status = order.status as ShopOrderStatus;
          const step = nextStep[status]?.[order.fulfilment];
          const canCancel =
            ["awaiting_payment", "paid", "ready_for_pickup", "out_for_delivery"].includes(status) &&
            (status === "awaiting_payment" || isOwner);
          const attempt = order.attempts[0];
          const localPhone = `0${order.phoneE164.slice(4)}`;

          return (
            <article
              className="dashboard-panel order-card"
              data-attention={order.needsAttention ? "true" : undefined}
              key={order.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-3xl">{order.code}</p>
                  <p className="text-sm text-ink/55">
                    {order.paidAt ? `Paid ${time(order.paidAt)}` : `Placed ${time(order.createdAt)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="status-pill">{orderStatusLabels[status]}</span>
                  <span className="status-pill inline-flex items-center gap-1">
                    {order.fulfilment === "pickup" ? <Store size={13} /> : <Bike size={13} />}
                    {order.fulfilment === "pickup" ? "Pickup" : "Delivery"}
                  </span>
                </div>
              </div>

              {order.needsAttention ? (
                <p className="form-error flex items-start gap-2">
                  <CircleAlert size={16} className="mt-0.5 flex-none" /> {order.needsAttention}
                </p>
              ) : null}

              <div className="grid gap-6 md:grid-cols-2">
                <ul className="grid gap-1 text-sm">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>
                        <strong>{item.quantity} ×</strong> {item.nameSnapshot}
                        {item.optionLabel ? ` (${item.optionLabel})` : ""}
                      </span>
                      <span>KES {item.lineTotalKes.toLocaleString("en-KE")}</span>
                    </li>
                  ))}
                  {order.deliveryFeeKes ? (
                    <li className="flex justify-between gap-3 text-ink/60">
                      <span>Delivery</span>
                      <span>KES {order.deliveryFeeKes.toLocaleString("en-KE")}</span>
                    </li>
                  ) : null}
                  <li className="mt-1 flex justify-between gap-3 border-t border-ink/10 pt-2 font-bold">
                    <span>Total</span>
                    <span>KES {order.totalKes.toLocaleString("en-KE")}</span>
                  </li>
                </ul>
                <div className="grid content-start gap-1 text-sm">
                  <p>
                    <strong>{order.customerName}</strong>
                  </p>
                  <a className="inline-flex items-center gap-1 underline underline-offset-4" href={`tel:${order.phoneE164}`}>
                    <Phone size={13} /> {localPhone}
                  </a>
                  {order.fulfilment === "delivery" ? (
                    <>
                      <p className="mt-2">
                        {order.deliveryAreaName} · {order.deliveryAddress}
                      </p>
                      {order.deliveryNotes ? <p className="text-ink/60">Note: {order.deliveryNotes}</p> : null}
                    </>
                  ) : null}
                  {order.mpesaReceipt ? (
                    <p className="mt-2 text-ink/60">
                      M-Pesa receipt:{" "}
                      {order.mpesaReceipt.startsWith("STK-") ? "confirmed, receipt number pending" : order.mpesaReceipt}
                    </p>
                  ) : null}
                  {status === "awaiting_payment" && attempt ? (
                    <p className="mt-2 text-ink/60">
                      {attempt.status === "pending"
                        ? "Prompt sent, waiting for the customer."
                        : attempt.status === "failed"
                          ? paymentFailureMessage(attempt.resultCode)
                          : "Payment received."}
                    </p>
                  ) : null}
                  {order.cancelReason ? <p className="mt-2 text-ink/60">Cancelled: {order.cancelReason}</p> : null}
                </div>
              </div>

              {step || canCancel ? (
                <div className="flex flex-wrap items-start gap-4 border-t border-ink/10 pt-4">
                  {step ? (
                    <ActionForm action={advanceShopOrder} submitLabel={step[1]}>
                      <input name="id" type="hidden" value={order.id} />
                      <input name="to" type="hidden" value={step[0]} />
                    </ActionForm>
                  ) : null}
                  {canCancel ? (
                    <details className="min-w-64 flex-1">
                      <summary className="cursor-pointer py-3 text-sm font-semibold text-rust">Cancel order</summary>
                      <ActionForm action={cancelShopOrder} submitLabel="Cancel this order" className="mt-2">
                        <input name="id" type="hidden" value={order.id} />
                        <label>
                          Reason
                          <input name="reason" maxLength={300} required placeholder="e.g. Customer asked to cancel" />
                        </label>
                        {order.paidAt ? (
                          <p className="text-xs text-ink/55">
                            The sale is voided in the reports. Send the refund from the M-Pesa till yourself.
                          </p>
                        ) : null}
                      </ActionForm>
                    </details>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
        {!orders.length ? <p className="text-sm text-ink/55">No orders here right now.</p> : null}
      </div>
    </main>
  );
}
