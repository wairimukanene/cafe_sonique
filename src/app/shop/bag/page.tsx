import type { Metadata } from "next";
import { connection } from "next/server";

import { BagView } from "@/components/shop/bag-view";
import { getPublicShopProducts } from "@/lib/shop/dal";

export const instant = false;

export const metadata: Metadata = { title: "Your bag — Sonique" };

export default async function BagPage() {
  await connection();
  const products = await getPublicShopProducts();

  return (
    <main className="shell py-14 md:py-20">
      <p className="eyebrow text-olive">Your bag</p>
      <h1 className="mt-4 font-display text-[clamp(3rem,6vw,5rem)] leading-[0.9] tracking-[-0.04em]">
        Almost <em>yours.</em>
      </h1>
      <BagView products={products} />
    </main>
  );
}
