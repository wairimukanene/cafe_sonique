import type { Metadata } from "next";
import { connection } from "next/server";

import { CheckoutForm } from "@/components/shop/checkout-form";
import { getPublicDeliveryAreas, getPublicShopProducts } from "@/lib/shop/dal";
import { getMpesaStatus } from "@/lib/shop/mpesa";

export const instant = false;

export const metadata: Metadata = { title: "Checkout — Sonique" };

export default async function CheckoutPage() {
  await connection();
  const [products, areas] = await Promise.all([getPublicShopProducts(), getPublicDeliveryAreas()]);

  return (
    <main className="shell py-14 md:py-20">
      <p className="eyebrow text-olive">Checkout</p>
      <h1 className="mt-4 font-display text-[clamp(3rem,6vw,5rem)] leading-[0.9] tracking-[-0.04em]">
        Pay with <em>M-Pesa.</em>
      </h1>
      <CheckoutForm
        products={products}
        areas={areas.map((area) => ({ id: area.id, name: area.name, feeKes: area.feeKes }))}
        paymentsReady={getMpesaStatus().ready}
      />
    </main>
  );
}
