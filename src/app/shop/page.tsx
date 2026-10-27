import { connection } from "next/server";

import { ProductGrid } from "@/components/shop/product-grid";
import { getPublicShopProducts } from "@/lib/shop/dal";
import { getMpesaStatus } from "@/lib/shop/mpesa";

export const instant = false;

export default async function ShopPage() {
  await connection();
  const products = await getPublicShopProducts();
  const payments = getMpesaStatus();

  return (
    <main className="shell py-14 pb-32 md:py-20">
      <p className="eyebrow text-olive">The Sonique shop</p>
      <h1 className="mt-4 max-w-4xl font-display text-[clamp(3.4rem,7vw,6.5rem)] leading-[0.88] tracking-[-0.045em]">
        Take a piece of <em>the room</em> home.
      </h1>
      <p className="mt-6 max-w-xl leading-7 text-ink/70">
        Pay with M-Pesa, then collect at the café for free, or have it delivered across Nairobi.
      </p>
      {!payments.ready ? (
        <p className="booking-error mt-6 max-w-xl" role="status">
          Online payment opens soon. You can browse now and buy at the bar in the meantime.
        </p>
      ) : null}
      {products.length ? (
        <ProductGrid products={products} />
      ) : (
        <p className="mt-14 text-ink/60">New merchandise is on its way. Check back soon.</p>
      )}
    </main>
  );
}
