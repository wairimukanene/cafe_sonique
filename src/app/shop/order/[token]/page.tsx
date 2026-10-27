import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { OrderStatus } from "@/components/shop/order-status";
import { getPublicOrder } from "@/lib/shop/service";

export const instant = false;

export const metadata: Metadata = {
  title: "Your order — Sonique",
  robots: { index: false, follow: false },
};

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const order = await getPublicOrder(token);
  if (!order) notFound();

  return (
    <main className="shell py-14 md:py-20">
      <p className="eyebrow text-olive">Your order</p>
      <h1 className="mt-4 font-display text-[clamp(3rem,6vw,5rem)] leading-[0.9] tracking-[-0.04em]">
        Thanks, <em>{order.customerName.split(" ")[0]}.</em>
      </h1>
      <OrderStatus token={token} initial={order} />
    </main>
  );
}
