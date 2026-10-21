import { and, eq, like, ne, notInArray, sql } from "drizzle-orm";

import { auth } from "../src/lib/auth-core";
import { db } from "../src/lib/db/client";
import {
  cafeSetting,
  event,
  expenseCategory,
  inventoryItem,
  mediaAsset,
  menuCategory,
  menuItem,
  user,
} from "../src/lib/db/schema";
import { photoSlots } from "../src/lib/media/slots";

async function ensureStaff(
  name: string,
  email: string,
  password: string,
  role: "owner" | "barista",
) {
  const existing = await db.query.user.findFirst({
    where: eq(user.email, email),
  });

  if (!existing) {
    await auth.api.signUpEmail({
      body: { name, email, password },
    });
  }

  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.email, email));
}

async function main() {
  const ownerPassword = process.env.OWNER_PASSWORD;
  const baristaPassword = process.env.BARISTA_PASSWORD;

  if (!ownerPassword || !baristaPassword) {
    throw new Error("OWNER_PASSWORD and BARISTA_PASSWORD are required for seeding.");
  }

  await ensureStaff(
    process.env.OWNER_NAME ?? "Sonique Owner",
    process.env.OWNER_EMAIL ?? "owner@cafesonique.local",
    ownerPassword,
    "owner",
  );
  await ensureStaff(
    process.env.BARISTA_NAME ?? "Sonique Barista",
    process.env.BARISTA_EMAIL ?? "barista@cafesonique.local",
    baristaPassword,
    "barista",
  );

  await db
    .insert(menuCategory)
    .values([
      { id: "cat-espresso", name: "Coffee", slug: "coffee", sortOrder: 1 },
      { id: "cat-tea", name: "Tea", slug: "tea", sortOrder: 2 },
      { id: "cat-specials", name: "Pastries", slug: "pastries", sortOrder: 3 },
    ])
    .onConflictDoUpdate({
      target: menuCategory.id,
      set: {
        name: sql`excluded.name`,
        slug: sql`excluded.slug`,
        sortOrder: sql`excluded.sort_order`,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(menuItem)
    .values([
      { id: "item-espresso", categoryId: "cat-espresso", name: "Espresso", description: "A focused, syrupy double shot", priceKes: 250, sortOrder: 1 },
      { id: "item-flat-white", categoryId: "cat-espresso", name: "Flat white", description: "Double espresso, textured milk", priceKes: 380, sortOrder: 2 },
      { id: "item-cappuccino", categoryId: "cat-espresso", name: "Cappuccino", description: "Espresso, milk, generous foam", priceKes: 380, sortOrder: 3 },
      { id: "item-v60", categoryId: "cat-espresso", name: "V60 pour-over", description: "Ask what we’re brewing today", priceKes: 450, sortOrder: 4 },
      { id: "item-mont-blanc", categoryId: "cat-espresso", name: "Mont Blanc", description: "Iced coffee, citrus cream", priceKes: 530, sortOrder: 5 },
      { id: "item-affogato", categoryId: "cat-espresso", name: "Affogato", description: "Vanilla ice cream, espresso", priceKes: 480, sortOrder: 6 },
      { id: "item-cold-brew", categoryId: "cat-espresso", name: "Cold brew", description: "Slow-steeped, bright and smooth", priceKes: 400, sortOrder: 7 },
      { id: "item-special-tea", categoryId: "cat-tea", name: "Special-tea", description: "Our rotating house tea", priceKes: 420, sortOrder: 1 },
    ])
    .onConflictDoNothing();

  await db
    .update(menuItem)
    .set({ categoryId: "cat-tea", updatedAt: new Date() })
    .where(and(eq(menuItem.id, "item-special-tea"), eq(menuItem.categoryId, "cat-specials")));

  const coffeeDrinks = [
    { id: "item-mont-blanc", sortOrder: 5 },
    { id: "item-affogato", sortOrder: 6 },
    { id: "item-cold-brew", sortOrder: 7 },
  ];
  for (const drink of coffeeDrinks) {
    await db
      .update(menuItem)
      .set({ categoryId: "cat-espresso", sortOrder: drink.sortOrder, updatedAt: new Date() })
      .where(and(eq(menuItem.id, drink.id), eq(menuItem.categoryId, "cat-specials")));
  }

  await db
    .insert(event)
    .values({
      id: "event-listening-001",
      title: "Community listening session",
      slug: "community-listening-session",
      description: "Bring a favourite album and share a side with the room.",
      startsAt: new Date("2026-11-07T16:00:00+03:00"),
      capacity: 24,
      status: "published",
    })
    .onConflictDoNothing();

  for (const slot of photoSlots) {
    await db
      .delete(mediaAsset)
      .where(
        and(
          eq(mediaAsset.key, slot.key),
          like(mediaAsset.path, "/images/sonique/%"),
          slot.defaultPath ? ne(mediaAsset.path, slot.defaultPath) : undefined,
        ),
      );
  }
  await db
    .delete(mediaAsset)
    .where(
      and(
        notInArray(mediaAsset.key, photoSlots.map((slot) => slot.key)),
        like(mediaAsset.path, "/images/sonique/%"),
      ),
    );

  await db
    .insert(cafeSetting)
    .values([
      { key: "operations.till_number", value: "BUY_GOODS_TILL" },
      { key: "operations.loyalty_visits_required", value: 5 },
      { key: "operations.loyalty_reward_cap_kes", value: 530 },
    ])
    .onConflictDoNothing();

  await db
    .insert(expenseCategory)
    .values([
      { id: "expense-supplies", name: "Supplies", slug: "supplies", sortOrder: 1 },
      { id: "expense-stock", name: "Stock purchases", slug: "stock-purchases", sortOrder: 2 },
      { id: "expense-utilities", name: "Utilities", slug: "utilities", sortOrder: 3 },
      { id: "expense-events", name: "Events", slug: "events", sortOrder: 4 },
      { id: "expense-other", name: "Other", slug: "other", sortOrder: 5 },
    ])
    .onConflictDoNothing();

  await db
    .insert(inventoryItem)
    .values([
      { id: "inventory-coffee-beans", name: "Coffee beans", sku: "BEANS", unit: "kg", onHand: 0, reorderLevel: 2 },
      { id: "inventory-whole-milk", name: "Whole milk", sku: "MILK-WHOLE", unit: "litre", onHand: 0, reorderLevel: 6 },
      { id: "inventory-oat-milk", name: "Oat milk", sku: "MILK-OAT", unit: "litre", onHand: 0, reorderLevel: 3 },
      { id: "inventory-cups", name: "Takeaway cups", sku: "CUPS", unit: "piece", onHand: 0, reorderLevel: 50 },
    ])
    .onConflictDoNothing();

  console.log("Café Sonique database seeded.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
