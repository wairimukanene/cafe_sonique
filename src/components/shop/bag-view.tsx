"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Minus, Package, Plus, X } from "lucide-react";

import type { PublicShopProduct } from "@/lib/shop/dal";
import { formatKes, removeFromCart, setCartQuantity, useCart, type CartLine } from "./cart";

export type ResolvedLine = {
  optionId: string;
  quantity: number;
  product: PublicShopProduct;
  label: string | null;
  photo: { src: string; alt: string } | null;
  stock: number;
  lineTotalKes: number;
};

export function resolveCart(cart: CartLine[], products: PublicShopProduct[]) {
  const byOption = new Map(
    products.flatMap((product) => product.options.map((option) => [option.id, { product, option }] as const)),
  );
  const lines: ResolvedLine[] = [];
  const missing: string[] = [];
  for (const line of cart) {
    const match = byOption.get(line.optionId);
    if (!match) {
      missing.push(line.optionId);
      continue;
    }
    const colour = match.product.colours.find((item) => item.id === match.option.colourId);
    lines.push({
      optionId: line.optionId,
      quantity: line.quantity,
      product: match.product,
      label: match.option.displayLabel,
      photo: colour?.imagePath
        ? { src: colour.imagePath, alt: colour.imageAlt }
        : match.product.imagePath
          ? { src: match.product.imagePath, alt: match.product.imageAlt }
          : null,
      stock: match.option.stock,
      lineTotalKes: match.product.priceKes * line.quantity,
    });
  }
  const itemsTotalKes = lines.reduce((sum, line) => sum + line.lineTotalKes, 0);
  const problems = lines.filter((line) => line.quantity > line.stock);
  return { lines, missing, itemsTotalKes, problems };
}

export function BagView({ products }: { products: PublicShopProduct[] }) {
  const cart = useCart();
  const { lines, missing, itemsTotalKes, problems } = resolveCart(cart, products);

  if (!lines.length && !missing.length) {
    return (
      <div className="mt-10 max-w-lg">
        <p className="text-ink/65">Your bag is empty.</p>
        <Link className="submit-button mt-6 max-w-xs" href="/shop">
          Browse the shop <ArrowRight size={17} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
      <ul className="bag-lines">
        {lines.map((line) => (
          <li key={line.optionId} className="bag-line">
            <div className="bag-thumb">
              {line.photo ? (
                <Image src={line.photo.src} alt={line.photo.alt} fill sizes="96px" className="object-cover" />
              ) : (
                <Package size={26} strokeWidth={1} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl leading-none">{line.product.name}</p>
              <p className="mt-1 text-sm text-ink/60">
                {line.label ? `${line.label} · ` : ""}
                {formatKes(line.product.priceKes)} each
              </p>
              {line.quantity > line.stock ? (
                <p className="mt-2 text-xs font-bold text-rust">
                  {line.stock ? `Only ${line.stock} left. Lower the quantity to continue.` : "Sold out. Remove it to continue."}
                </p>
              ) : null}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="qty-button"
                  aria-label={`One less ${line.product.name}`}
                  onClick={() => setCartQuantity(line.optionId, line.quantity - 1)}
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center font-bold" aria-live="polite">{line.quantity}</span>
                <button
                  type="button"
                  className="qty-button"
                  aria-label={`One more ${line.product.name}`}
                  disabled={line.quantity >= line.stock}
                  onClick={() => setCartQuantity(line.optionId, line.quantity + 1)}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div className="flex flex-col items-end justify-between">
              <button
                type="button"
                className="text-ink/45 hover:text-rust"
                aria-label={`Remove ${line.product.name}`}
                onClick={() => removeFromCart(line.optionId)}
              >
                <X size={18} />
              </button>
              <p className="font-display text-xl">{formatKes(line.lineTotalKes)}</p>
            </div>
          </li>
        ))}
        {missing.map((optionId) => (
          <li key={optionId} className="bag-line text-sm text-ink/60">
            <p className="flex-1">An item in your bag is no longer available.</p>
            <button type="button" className="font-bold text-rust" onClick={() => removeFromCart(optionId)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <aside className="bag-summary">
        <div className="flex justify-between">
          <span>Items</span>
          <span className="font-bold">{formatKes(itemsTotalKes)}</span>
        </div>
        <p className="mt-2 text-sm text-ink/55">Pickup at the café is free. Delivery fees are shown at checkout.</p>
        {problems.length || missing.length ? (
          <p className="booking-error mt-5">Fix the items marked above to continue.</p>
        ) : (
          <Link className="submit-button mt-6" href="/shop/checkout">
            Checkout <ArrowRight size={17} />
          </Link>
        )}
        <Link className="mt-4 block text-center text-sm underline underline-offset-4" href="/shop">
          Keep browsing
        </Link>
      </aside>
    </div>
  );
}
