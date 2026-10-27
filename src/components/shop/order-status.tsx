"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, Smartphone } from "lucide-react";

import { resendPaymentPrompt } from "@/app/actions/shop";
import type { PublicOrder } from "@/lib/shop/service";
import { formatKes } from "./cart";

const POLL_MS = 3000;

const afterPayment: Record<string, { title: string; body: (order: PublicOrder) => string }> = {
  paid: {
    title: "Paid. Thank you!",
    body: (order) =>
      order.fulfilment === "pickup"
        ? "We're packing your order. This page changes to “Ready to collect” as soon as it's waiting at the bar."
        : "We're packing your order and will send it out with a rider soon.",
  },
  ready_for_pickup: {
    title: "Ready to collect",
    body: () => "Your order is waiting at the bar. Show this page or your order code to the barista.",
  },
  out_for_delivery: {
    title: "On the way",
    body: () => "A rider is bringing your order now.",
  },
  completed: {
    title: "Completed",
    body: () => "Enjoy! We hope to see you at Sonique soon.",
  },
};

export function OrderStatus({ token, initial }: { token: string; initial: PublicOrder }) {
  const [order, setOrder] = useState(initial);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [resending, startResend] = useTransition();
  const awaiting = order.status === "awaiting_payment";

  const pollMs = awaiting ? POLL_MS : order.status in afterPayment && order.status !== "completed" ? 30_000 : null;

  useEffect(() => {
    if (!pollMs) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/shop/orders/${token}`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        setOrder((await response.json()) as PublicOrder);
      } catch {
        // Keep the last known state and try again on the next tick.
      }
    }, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pollMs, token]);

  function resend() {
    setNotice(null);
    startResend(async () => {
      const result = await resendPaymentPrompt(token);
      setNotice(result);
      const response = await fetch(`/api/shop/orders/${token}`, { cache: "no-store" });
      if (response.ok) setOrder((await response.json()) as PublicOrder);
    });
  }

  const done = afterPayment[order.status];
  const failed = order.payment?.state === "failed";

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
      <section className="booking-card checkout-card" aria-live="polite">
        {done ? (
          <>
            <CheckCircle2 className="text-olive" size={40} strokeWidth={1.5} />
            <h2 className="mt-4 font-display text-4xl">{done.title}</h2>
            <p className="mt-3 max-w-lg leading-7 text-ink/70">{done.body(order)}</p>
            {order.receipt && !order.receipt.startsWith("STK-") ? (
              <p className="mt-5 text-sm">
                M-Pesa receipt <strong className="tracking-wide">{order.receipt}</strong>
              </p>
            ) : null}
          </>
        ) : order.status === "expired" ? (
          <>
            <CircleAlert className="text-rust" size={40} strokeWidth={1.5} />
            <h2 className="mt-4 font-display text-4xl">This order expired</h2>
            <p className="mt-3 max-w-lg leading-7 text-ink/70">
              We didn&apos;t receive payment in time, so the items went back on the shelf. Nothing was charged.
            </p>
            <Link className="submit-button mt-6 max-w-xs" href="/shop">
              Back to the shop
            </Link>
          </>
        ) : order.status === "cancelled" ? (
          <>
            <CircleAlert className="text-rust" size={40} strokeWidth={1.5} />
            <h2 className="mt-4 font-display text-4xl">This order was cancelled</h2>
            <p className="mt-3 max-w-lg leading-7 text-ink/70">
              If you paid, the café will arrange your refund. Ask at the bar or message @cafe_sonique.
            </p>
          </>
        ) : failed ? (
          <>
            <CircleAlert className="text-rust" size={40} strokeWidth={1.5} />
            <h2 className="mt-4 font-display text-4xl">Payment didn&apos;t go through</h2>
            <p className="mt-3 max-w-lg leading-7 text-ink/70">{order.payment?.message}</p>
          </>
        ) : (
          <>
            <Smartphone className="text-olive" size={40} strokeWidth={1.5} />
            <h2 className="mt-4 font-display text-4xl">Check your phone</h2>
            <p className="mt-3 max-w-lg leading-7 text-ink/70">
              {order.payment
                ? `We sent an M-Pesa prompt to ${order.phone}. Enter your PIN to pay ${formatKes(order.totalKes)}.`
                : "We couldn't send the M-Pesa prompt. Try sending it again below."}
            </p>
            <p className="mt-5 flex items-center gap-2 text-sm text-ink/55">
              <LoaderCircle className="animate-spin" size={16} /> Waiting for confirmation from M-Pesa
            </p>
          </>
        )}

        {awaiting ? (
          <div className="mt-8 border-t border-ink/10 pt-6">
            {order.canRetry ? (
              <button className="staff-secondary-button" type="button" onClick={resend} disabled={resending}>
                {resending ? "Sending…" : failed || !order.payment ? "Try again" : "Didn't get it? Send again"}
              </button>
            ) : null}
            {notice && !(notice.ok && failed) ? (
              <p className={notice.ok ? "booking-success mt-4" : "booking-error mt-4"} role="status">
                {notice.message}
              </p>
            ) : null}
            <p className="mt-4 text-xs text-ink/50">
              Items held until{" "}
              {new Date(order.holdExpiresAt).toLocaleTimeString("en-KE", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Africa/Nairobi",
              })}
              . {order.attemptsLeft} {order.attemptsLeft === 1 ? "prompt" : "prompts"} left.
            </p>
          </div>
        ) : null}
      </section>

      <aside className="bag-summary h-fit">
        <p className="eyebrow text-olive">Order {order.code}</p>
        <ul className="mt-4 grid gap-2 text-sm">
          {order.items.map((item, index) => (
            <li key={index} className="flex justify-between gap-3">
              <span>
                {item.quantity} × {item.name}
                {item.option ? ` (${item.option})` : ""}
              </span>
              <span>{formatKes(item.lineTotalKes)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-1 border-t border-ink/15 pt-4 text-sm">
          <div className="flex justify-between">
            <span>{order.fulfilment === "delivery" ? `Delivery · ${order.deliveryAreaName}` : "Pickup at the café"}</span>
            <span>{order.deliveryFeeKes ? formatKes(order.deliveryFeeKes) : "Free"}</span>
          </div>
          <div className="mt-2 flex justify-between font-display text-2xl">
            <span>Total</span>
            <span>{formatKes(order.totalKes)}</span>
          </div>
        </div>
        {order.fulfilment === "delivery" && order.deliveryAddress ? (
          <p className="mt-4 text-sm text-ink/60">{order.deliveryAddress}</p>
        ) : null}
        <p className="mt-4 text-xs text-ink/50">Bookmark this page to check on your order.</p>
      </aside>
    </div>
  );
}
