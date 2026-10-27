import { and, eq, like, ne, notInArray, sql } from "drizzle-orm";

import { auth } from "../src/lib/auth-core";
import { db } from "../src/lib/db/client";
import {
  cafeSetting,
  deliveryArea,
  event,
  expenseCategory,
  inventoryItem,
  mediaAsset,
  menuCategory,
  menuItem,
  shopProduct,
  shopProductColour,
  shopProductOption,
  user,
} from "../src/lib/db/schema";
import { photoSlots } from "../src/lib/media/slots";
import { DEFAULT_OPTION_LABEL, slugify } from "../src/lib/shop/domain";

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
  if (process.argv.includes("--shop-only")) {
    await seedShop();
    console.log("Shop products seeded.");
    return;
  }

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

  await seedShop();

  console.log("Café Sonique database seeded.");
}

const placeholderProducts = [
  {
    id: "shop-tee",
    name: "Sonique tee",
    slug: "sonique-tee",
    description: "White cotton tee with the orange Sonique wordmark on the chest. The one our baristas wear behind the bar.",
    priceKes: 2500,
    imagePath: "/images/shop/tee-barista.jpg",
    imageAlt: "Sonique barista behind the bar wearing the white tee with the orange Sonique wordmark",
    featured: true,
    colours: [
      {
        name: "White",
        imagePath: "/images/shop/tee-barista.jpg",
        imageAlt: "Sonique barista wearing the white tee with the orange Sonique wordmark",
        options: ["S", "M", "L", "XL"].map((label) => ({ label, stock: 8 })),
      },
      {
        name: "Black",
        imagePath: "/images/shop/tee-black.jpg",
        imageAlt: "Black Sonique tee with the orange wordmark, laid flat on the counter",
        options: ["S", "M", "L", "XL"].map((label) => ({ label, stock: 5 })),
      },
    ],
  },
  {
    id: "shop-mug",
    name: "Sonique mug",
    slug: "sonique-mug",
    description: "The same cup we pour your flat white into.",
    priceKes: 1200,
    imagePath: "/images/shop/mug.jpg",
    imageAlt: "Ceramic Sonique coffee mug",
    featured: true,
    colours: [
      {
        name: "White",
        imagePath: "/images/shop/mug.jpg",
        imageAlt: "White ceramic Sonique mug with the green logo",
        options: [{ label: DEFAULT_OPTION_LABEL, stock: 20 }],
      },
      {
        name: "Black",
        imagePath: "/images/shop/mug-black.jpg",
        imageAlt: "Matte black Sonique mug with the green logo",
        options: [{ label: DEFAULT_OPTION_LABEL, stock: 12 }],
      },
    ],
  },
  {
    id: "shop-keyholder",
    name: "Keyholder",
    slug: "keyholder",
    description: "Enamel and brass, so your keys always come back to the room.",
    priceKes: 600,
    imagePath: "/images/shop/keyholder.jpg",
    imageAlt: "Enamel and brass Sonique keyholder",
    featured: true,
    options: [{ label: DEFAULT_OPTION_LABEL, stock: 25 }],
  },
  {
    id: "shop-game-cards",
    name: "Sonique game cards",
    slug: "game-cards",
    description: "Our orange deck of game cards on a ring. Pass them round the table over coffee.",
    priceKes: 800,
    imagePath: "/images/shop/game-cards.jpg",
    imageAlt: "A hand holding the orange Sonique game cards on a ring",
    featured: false,
    options: [{ label: DEFAULT_OPTION_LABEL, stock: 30 }],
  },
  {
    id: "shop-stickers",
    name: "Sticker pack",
    slug: "sticker-pack",
    description: "Five die-cut stickers for laptops and bottles.",
    priceKes: 400,
    imagePath: "/images/shop/stickers.jpg",
    imageAlt: "Pack of five Sonique die-cut stickers",
    featured: false,
    options: [{ label: DEFAULT_OPTION_LABEL, stock: 40 }],
  },
];

async function seedShop() {
  const [{ products }] = await db.select({ products: sql<number>`count(*)::int` }).from(shopProduct);
  if (products === 0) {
    for (const [index, entry] of placeholderProducts.entries()) {
      const { colours = [], options = [], ...product } = entry;
      await db.insert(shopProduct).values({ ...product, sortOrder: index });
      const variants = colours.length
        ? colours.map(({ options: colourOptions, ...colour }) => ({
            colourId: `${product.id}-${slugify(colour.name)}`,
            colour,
            options: colourOptions,
          }))
        : [{ colourId: null, colour: null, options }];
      let sortOrder = 0;
      for (const [colourIndex, variant] of variants.entries()) {
        if (variant.colour && variant.colourId) {
          await db.insert(shopProductColour).values({
            id: variant.colourId,
            productId: product.id,
            sortOrder: colourIndex,
            ...variant.colour,
          });
        }
        await db.insert(shopProductOption).values(
          variant.options.map((option) => ({
            id: `${variant.colourId ?? product.id}-${slugify(option.label)}`,
            productId: product.id,
            colourId: variant.colourId,
            label: option.label,
            stock: option.stock,
            sortOrder: sortOrder++,
          })),
        );
      }
    }
  }

  const [{ areas }] = await db.select({ areas: sql<number>`count(*)::int` }).from(deliveryArea);
  if (areas === 0) {
    await db.insert(deliveryArea).values({ id: "area-westlands", name: "Westlands & Parklands", feeKes: 250 });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
