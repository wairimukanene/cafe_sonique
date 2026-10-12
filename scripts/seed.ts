import { eq } from "drizzle-orm";

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
      { id: "cat-espresso", name: "Espresso bar", slug: "espresso-bar", sortOrder: 1 },
      { id: "cat-specials", name: "Sonique specials", slug: "sonique-specials", sortOrder: 2 },
    ])
    .onConflictDoNothing();

  await db
    .insert(menuItem)
    .values([
      { id: "item-espresso", categoryId: "cat-espresso", name: "Espresso", description: "A focused, syrupy double shot", priceKes: 250, sortOrder: 1 },
      { id: "item-flat-white", categoryId: "cat-espresso", name: "Flat white", description: "Double espresso, textured milk", priceKes: 380, sortOrder: 2 },
      { id: "item-cappuccino", categoryId: "cat-espresso", name: "Cappuccino", description: "Espresso, milk, generous foam", priceKes: 380, sortOrder: 3 },
      { id: "item-v60", categoryId: "cat-espresso", name: "V60 pour-over", description: "Ask what we’re brewing today", priceKes: 450, sortOrder: 4 },
      { id: "item-mont-blanc", categoryId: "cat-specials", name: "Mont Blanc", description: "Iced coffee, citrus cream", priceKes: 530, sortOrder: 1 },
      { id: "item-affogato", categoryId: "cat-specials", name: "Affogato", description: "Vanilla ice cream, espresso", priceKes: 480, sortOrder: 2 },
      { id: "item-special-tea", categoryId: "cat-specials", name: "Special-tea", description: "Our rotating house tea", priceKes: 420, sortOrder: 3 },
      { id: "item-cold-brew", categoryId: "cat-specials", name: "Cold brew", description: "Slow-steeped, bright and smooth", priceKes: 400, sortOrder: 4 },
    ])
    .onConflictDoNothing();

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

  await db
    .insert(mediaAsset)
    .values([
      { id: "media-hero", key: "hero", path: "/images/sonique/hero.jpg", altText: "A Sonique barista preparing a hand-brewed coffee", sourcePermalink: "https://www.instagram.com/cafe_sonique/p/Dd4KSc6jYve/", approved: true },
      { id: "media-coffee", key: "coffee", path: "/images/sonique/coffee.jpg", altText: "Coffee being prepared at the Sonique bar", sourcePermalink: "https://www.instagram.com/cafe_sonique/p/Dd4KSc6jYve/", approved: true },
      { id: "media-affogato", key: "affogato", path: "/images/sonique/affogato.jpg", altText: "Sonique affogato with espresso and vanilla ice cream", sourcePermalink: "https://www.instagram.com/cafe_sonique/p/Dd_cPn7Das6/", approved: true },
      { id: "media-vibe", key: "vibe", path: "/images/sonique/vibe.jpg", altText: "Friends enjoying the relaxed atmosphere at Sonique", sourcePermalink: "https://www.instagram.com/cafe_sonique/p/DdyfYuDDURh/", approved: true },
      { id: "media-work", key: "work", path: "/images/sonique/montblanc.jpg", altText: "Orange zest over a Mont Blanc at Sonique", sourcePermalink: "https://www.instagram.com/cafe_sonique/p/Ddt5-uxjUZt/", approved: true },
    ])
    .onConflictDoNothing();

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
