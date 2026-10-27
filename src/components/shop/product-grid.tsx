"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Package, Plus } from "lucide-react";

import type { PublicShopProduct } from "@/lib/shop/dal";
import { addToCart, formatKes, useCart } from "./cart";

const LOW_STOCK = 3;

export function ProductGrid({ products }: { products: PublicShopProduct[] }) {
  const cart = useCart();
  const prices = new Map(
    products.flatMap((product) => product.options.map((option) => [option.id, product.priceKes] as const)),
  );
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const total = cart.reduce((sum, line) => sum + (prices.get(line.optionId) ?? 0) * line.quantity, 0);

  return (
    <>
      <div className="shop-grid">
        {products.map((product, index) => (
          <ProductCard key={product.id} product={product} inBag={cart} eager={index < 4} />
        ))}
      </div>
      {count ? (
        <Link className="bag-bar" href="/shop/bag">
          {count} {count === 1 ? "item" : "items"} in your bag · {formatKes(total)} · View bag
          <ArrowRight size={17} />
        </Link>
      ) : null}
    </>
  );
}

function ProductCard({
  product,
  inBag,
  eager,
}: {
  product: PublicShopProduct;
  inBag: { optionId: string; quantity: number }[];
  eager: boolean;
}) {
  const firstAvailable = product.options.find((option) => option.stock > 0) ?? product.options[0];
  const [optionId, setOptionId] = useState(firstAvailable.id);
  const [justAdded, setJustAdded] = useState(false);
  const option = product.options.find((item) => item.id === optionId) ?? firstAvailable;
  const alreadyInBag = inBag.find((line) => line.optionId === option.id)?.quantity ?? 0;
  const remaining = option.stock - alreadyInBag;
  const soldOut = product.options.every((item) => item.stock <= 0);
  const colour = product.colours.find((item) => item.id === option.colourId) ?? null;
  const sizes = colour ? product.options.filter((item) => item.colourId === colour.id) : product.options;
  const photo = colour?.imagePath
    ? { src: colour.imagePath, alt: colour.imageAlt }
    : product.imagePath
      ? { src: product.imagePath, alt: product.imageAlt }
      : null;

  function chooseColour(colourId: string) {
    const inColour = product.options.filter((item) => item.colourId === colourId);
    const next =
      inColour.find((item) => item.label === option.label && item.stock > 0) ??
      inColour.find((item) => item.stock > 0) ??
      inColour[0];
    if (next) setOptionId(next.id);
  }

  function add() {
    if (remaining <= 0) return;
    addToCart(option.id);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1600);
  }

  return (
    <article className="shop-card" id={product.slug}>
      <div className="shop-photo">
        {photo ? (
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            loading={eager ? "eager" : undefined}
            sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="photo-placeholder" role="img" aria-label={product.imageAlt}>
            <Package size={40} strokeWidth={1} />
          </div>
        )}
        {soldOut ? <span className="shop-badge">Sold out</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-3xl leading-none">{product.name}</h2>
          <p className="font-display whitespace-nowrap text-xl">{formatKes(product.priceKes)}</p>
        </div>
        <p className="text-sm leading-6 text-ink/65">{product.description}</p>
        {product.colours.length ? (
          <fieldset>
            <legend className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink/55">
              Colour{colour ? ` · ${colour.name}` : ""}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {product.colours.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="shop-option"
                  aria-pressed={item.id === colour?.id}
                  disabled={!product.options.some((variant) => variant.colourId === item.id && variant.stock > 0)}
                  onClick={() => chooseColour(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
        {sizes.some((item) => item.sized) ? (
          <fieldset>
            <legend className={product.colours.length ? "mb-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink/55" : "sr-only"}>
              Size
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {sizes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="shop-option"
                  aria-pressed={item.id === option.id}
                  disabled={item.stock <= 0}
                  onClick={() => setOptionId(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
        {!soldOut && option.stock > 0 && option.stock <= LOW_STOCK ? (
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-rust">
            Only {option.stock} left{option.displayLabel ? ` in ${option.displayLabel}` : ""}
          </p>
        ) : null}
        <button className="submit-button mt-auto" type="button" onClick={add} disabled={soldOut || remaining <= 0}>
          {soldOut
            ? "Sold out"
            : remaining <= 0
              ? "All in your bag"
              : justAdded
                ? "Added to bag"
                : alreadyInBag
                  ? `Add another (${alreadyInBag} in bag)`
                  : "Add to bag"}
          {justAdded ? <Check size={17} /> : <Plus size={17} />}
        </button>
      </div>
    </article>
  );
}
