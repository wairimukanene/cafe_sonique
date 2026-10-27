import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";
import {
  deliveryArea,
  shopOrder,
  shopPaymentAttempt,
  shopProduct,
  shopProductColour,
  shopProductOption,
} from "@/lib/db/schema";
import { DEFAULT_OPTION_LABEL, variantLabel, type ShopOrderStatus } from "./domain";
import { PUBLIC_SHOP_TAG } from "./service";

async function loadProducts(activeOnly: boolean) {
  return db.query.shopProduct.findMany({
    where: activeOnly ? eq(shopProduct.active, true) : undefined,
    orderBy: [asc(shopProduct.sortOrder), asc(shopProduct.name)],
    with: {
      options: { orderBy: [asc(shopProductOption.sortOrder), asc(shopProductOption.label)] },
      colours: { orderBy: [asc(shopProductColour.sortOrder), asc(shopProductColour.name)] },
    },
  });
}

export async function getPublicShopProducts() {
  "use cache";
  cacheTag(PUBLIC_SHOP_TAG);
  cacheLife("minutes");

  const products = await loadProducts(true);
  return products
    .filter((product) => product.options.length > 0)
    .map((product) => {
      const colours = product.colours.map((colour) => ({
        id: colour.id,
        name: colour.name,
        imagePath: colour.imagePath ?? product.imagePath,
        imageAlt: colour.imageAlt || `${product.name} in ${colour.name}`,
      }));
      const colourNames = new Map(colours.map((colour) => [colour.id, colour.name]));
      const coverColour = product.imagePath ? null : colours.find((colour) => colour.imagePath);
      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        priceKes: product.priceKes,
        imagePath: product.imagePath ?? coverColour?.imagePath ?? null,
        imageAlt: (product.imagePath ? product.imageAlt : coverColour?.imageAlt) || product.name,
        featured: product.featured,
        colours,
        options: product.options.map((option) => ({
          id: option.id,
          colourId: option.colourId,
          label: option.label,
          sized: option.label !== DEFAULT_OPTION_LABEL,
          displayLabel: variantLabel(option.colourId ? colourNames.get(option.colourId) : null, option.label),
          stock: option.stock,
        })),
      };
    });
}

export type PublicShopProduct = Awaited<ReturnType<typeof getPublicShopProducts>>[number];

export async function getFeaturedShopProducts() {
  const products = await getPublicShopProducts();
  const featured = products.filter((product) => product.featured);
  return (featured.length ? featured : products).slice(0, 3);
}

export async function getPublicDeliveryAreas() {
  "use cache";
  cacheTag(PUBLIC_SHOP_TAG);
  cacheLife("minutes");

  return db
    .select({ id: deliveryArea.id, name: deliveryArea.name, feeKes: deliveryArea.feeKes })
    .from(deliveryArea)
    .where(eq(deliveryArea.active, true))
    .orderBy(asc(deliveryArea.sortOrder), asc(deliveryArea.name));
}

export async function getStaffShopProducts() {
  return loadProducts(false);
}

export async function getStaffDeliveryAreas() {
  return db.select().from(deliveryArea).orderBy(asc(deliveryArea.sortOrder), asc(deliveryArea.name));
}

export const orderTabs = [
  { key: "to-pack", label: "To pack", statuses: ["paid"] },
  { key: "on-the-way", label: "Ready / out for delivery", statuses: ["ready_for_pickup", "out_for_delivery"] },
  { key: "waiting", label: "Waiting for payment", statuses: ["awaiting_payment"] },
  { key: "done", label: "Done", statuses: ["completed"] },
  { key: "closed", label: "Cancelled & expired", statuses: ["cancelled", "expired"] },
] as const satisfies readonly { key: string; label: string; statuses: readonly ShopOrderStatus[] }[];

export type OrderTabKey = (typeof orderTabs)[number]["key"];

export async function getStaffOrders(tab: OrderTabKey) {
  const definition = orderTabs.find((item) => item.key === tab) ?? orderTabs[0];
  const statuses = [...definition.statuses] as ShopOrderStatus[];
  const [orders, counts] = await Promise.all([
    db.query.shopOrder.findMany({
      where: inArray(shopOrder.status, statuses),
      orderBy: [definition.key === "to-pack" ? asc(shopOrder.paidAt) : desc(shopOrder.updatedAt)],
      limit: 100,
      with: {
        items: true,
        attempts: { orderBy: [desc(shopPaymentAttempt.createdAt)], limit: 1 },
      },
    }),
    db
      .select({ status: shopOrder.status, id: shopOrder.id })
      .from(shopOrder)
      .where(and(inArray(shopOrder.status, ["paid", "ready_for_pickup", "out_for_delivery", "awaiting_payment"]))),
  ]);
  const countByTab = Object.fromEntries(
    orderTabs.map((item) => [
      item.key,
      counts.filter((row) => (item.statuses as readonly string[]).includes(row.status)).length,
    ]),
  ) as Record<OrderTabKey, number>;
  return { tab: definition.key, orders, countByTab };
}
