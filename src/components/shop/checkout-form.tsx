"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Bike, LoaderCircle, Store } from "lucide-react";

import { placeShopOrder } from "@/app/actions/shop";
import type { PublicShopProduct } from "@/lib/shop/dal";
import { resolveCart } from "./bag-view";
import { clearCart, formatKes, useCart } from "./cart";

type DeliveryArea = { id: string; name: string; feeKes: number };

export function CheckoutForm({
  products,
  areas,
  paymentsReady,
}: {
  products: PublicShopProduct[];
  areas: DeliveryArea[];
  paymentsReady: boolean;
}) {
  const router = useRouter();
  const cart = useCart();
  const { lines, missing, itemsTotalKes, problems } = resolveCart(cart, products);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">("pickup");
  const [areaId, setAreaId] = useState("");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [placed, setPlaced] = useState(false);

  const area = areas.find((item) => item.id === areaId);
  const deliveryFeeKes = fulfilment === "delivery" ? (area?.feeKes ?? 0) : 0;
  const totalKes = itemsTotalKes + deliveryFeeKes;
  const bagBlocked = !lines.length || problems.length > 0 || missing.length > 0;

  if (placed) {
    return (
      <p className="mt-10 flex items-center gap-3 text-ink/70" role="status">
        <LoaderCircle className="animate-spin" size={18} /> Opening your order…
      </p>
    );
  }

  if (!lines.length) {
    return (
      <div className="mt-10 max-w-lg">
        <p className="text-ink/65">Your bag is empty.</p>
        <Link className="submit-button mt-6 max-w-xs" href="/shop">
          Browse the shop <ArrowRight size={17} />
        </Link>
      </div>
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    const payload = {
      idempotencyKey,
      items: lines.map((line) => ({ optionId: line.optionId, quantity: line.quantity })),
      fulfilment,
      deliveryAreaId: fulfilment === "delivery" ? areaId : undefined,
      deliveryAddress: fulfilment === "delivery" ? formData.get("deliveryAddress") : undefined,
      deliveryNotes: fulfilment === "delivery" ? formData.get("deliveryNotes") : undefined,
      customerName: formData.get("customerName"),
      phone: formData.get("phone"),
    };
    startTransition(async () => {
      const result = await placeShopOrder(payload);
      if (result.ok) {
        setPlaced(true);
        clearCart();
        router.push(`/shop/order/${result.token}`);
      } else {
        setError({ message: result.message, field: result.field });
      }
    });
  }

  const invalid = (field: string) => (error?.field === field ? true : undefined);

  return (
    <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="booking-card checkout-card">
        <fieldset>
          <legend className="checkout-legend">How do you want it?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="fulfilment-choice">
              <input
                type="radio"
                name="fulfilment"
                value="pickup"
                checked={fulfilment === "pickup"}
                onChange={() => setFulfilment("pickup")}
              />
              <Store size={20} />
              <span>
                <strong>Pick up at the café</strong>
                <small>Free. Collect it at the bar on Getathuru Road.</small>
              </span>
            </label>
            <label className="fulfilment-choice">
              <input
                type="radio"
                name="fulfilment"
                value="delivery"
                checked={fulfilment === "delivery"}
                disabled={!areas.length}
                onChange={() => setFulfilment("delivery")}
              />
              <Bike size={20} />
              <span>
                <strong>Deliver it</strong>
                <small>{areas.length ? "Rider delivery in Nairobi." : "Delivery isn't available yet."}</small>
              </span>
            </label>
          </div>
        </fieldset>

        {fulfilment === "delivery" ? (
          <fieldset className="mt-8 grid gap-5">
            <legend className="checkout-legend">Delivery</legend>
            <label>
              Area
              <select
                name="deliveryAreaId"
                value={areaId}
                onChange={(event) => setAreaId(event.target.value)}
                aria-invalid={invalid("deliveryAreaId")}
                required
              >
                <option value="">Choose your area</option>
                {areas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {formatKes(item.feeKes)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Address
              <input
                name="deliveryAddress"
                placeholder="Building, street, house or office number"
                autoComplete="street-address"
                aria-invalid={invalid("deliveryAddress")}
                maxLength={300}
                required
              />
            </label>
            <label>
              Notes for the rider (optional)
              <input name="deliveryNotes" placeholder="Gate code, landmark, best time" maxLength={300} />
            </label>
          </fieldset>
        ) : null}

        <fieldset className="mt-8 grid gap-5 sm:grid-cols-2">
          <legend className="checkout-legend">Your details</legend>
          <label>
            Name
            <input
              name="customerName"
              autoComplete="name"
              aria-invalid={invalid("customerName")}
              maxLength={100}
              required
            />
          </label>
          <label>
            M-Pesa phone number
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
              aria-invalid={invalid("phone")}
              required
            />
          </label>
        </fieldset>
        <p className="mt-4 text-sm text-ink/55">
          We&apos;ll send an M-Pesa prompt to this number. Enter your PIN on your phone to pay.
        </p>
      </div>

      <aside className="bag-summary h-fit">
        <ul className="grid gap-2 text-sm">
          {lines.map((line) => (
            <li key={line.optionId} className="flex justify-between gap-3">
              <span>
                {line.quantity} × {line.product.name}
                {line.label ? ` (${line.label})` : ""}
              </span>
              <span>{formatKes(line.lineTotalKes)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-1 border-t border-ink/15 pt-4 text-sm">
          <div className="flex justify-between">
            <span>Items</span>
            <span>{formatKes(itemsTotalKes)}</span>
          </div>
          <div className="flex justify-between">
            <span>{fulfilment === "delivery" ? "Delivery" : "Pickup"}</span>
            <span>
              {fulfilment === "pickup" ? "Free" : area ? formatKes(area.feeKes) : "Choose an area"}
            </span>
          </div>
          <div className="mt-2 flex justify-between font-display text-2xl">
            <span>Total</span>
            <span>{formatKes(totalKes)}</span>
          </div>
        </div>
        {error ? (
          <p className="booking-error mt-5" role="alert">
            {error.message}
          </p>
        ) : null}
        {bagBlocked ? (
          <p className="booking-error mt-5">
            Some items in your bag need attention. <Link className="underline" href="/shop/bag">Review bag</Link>
          </p>
        ) : null}
        <button className="submit-button mt-6 w-full" type="submit" disabled={pending || bagBlocked || !paymentsReady}>
          {pending ? (
            <>
              Sending prompt <LoaderCircle className="animate-spin" size={17} />
            </>
          ) : (
            <>
              Pay {formatKes(totalKes)} with M-Pesa <ArrowRight size={17} />
            </>
          )}
        </button>
        {!paymentsReady ? (
          <p className="mt-3 text-sm text-ink/60">Online payment isn&apos;t switched on yet. You can buy at the bar.</p>
        ) : null}
        <p className="mt-4 text-xs leading-5 text-ink/50">
          Your items are held for 10 minutes while you pay.
        </p>
      </aside>
    </form>
  );
}
