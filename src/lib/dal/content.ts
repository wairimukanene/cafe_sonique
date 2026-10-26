import "server-only";

import { and, asc, desc, eq, gte, inArray, like } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";
import {
  auditLog,
  booking,
  cafeSetting,
  event,
  guestThought,
  mediaAsset,
  menuCategory,
  menuItem,
} from "@/lib/db/schema";
import {
  photoSlots,
  videoSlotKeys,
  videoSlots,
  type PhotoSlotKey,
  type VideoSlotKey,
} from "@/lib/media/slots";
import { SITE_TEXT_PREFIX, siteTextDefaults, type SiteText } from "@/lib/site-text";

export type SitePhoto = { path: string | null; altText: string; updatedAt: Date | null };

async function loadSiteText() {
  const rows = await db
    .select({ key: cafeSetting.key, value: cafeSetting.value })
    .from(cafeSetting)
    .where(like(cafeSetting.key, `${SITE_TEXT_PREFIX}%`));
  const text = siteTextDefaults();
  for (const row of rows) {
    const key = row.key.slice(SITE_TEXT_PREFIX.length);
    if (key in text && typeof row.value === "string") {
      text[key as keyof SiteText] = row.value;
    }
  }
  return text;
}

export async function getPublicSiteText() {
  "use cache";
  cacheTag("public-site-text");
  cacheLife("hours");

  return loadSiteText();
}

export async function getStaffSiteText() {
  return loadSiteText();
}

async function loadSitePhotos(approvedOnly: boolean) {
  const rows = await db.query.mediaAsset.findMany(
    approvedOnly ? { where: eq(mediaAsset.approved, true) } : undefined,
  );
  const byKey = new Map(rows.map((row) => [row.key, row]));

  return Object.fromEntries(
    photoSlots.map((slot) => {
      const row = byKey.get(slot.key);
      return [
        slot.key,
        row
          ? { path: row.path, altText: row.altText, updatedAt: row.updatedAt }
          : { path: slot.defaultPath, altText: slot.defaultAlt, updatedAt: null },
      ];
    }),
  ) as Record<PhotoSlotKey, SitePhoto>;
}

export type SiteVideo = { path: string | null; title: string; updatedAt: Date | null };

async function loadSiteVideos() {
  const rows = await db.query.mediaAsset.findMany({
    where: inArray(mediaAsset.key, [...videoSlotKeys]),
  });
  const byKey = new Map(rows.map((row) => [row.key, row]));

  return Object.fromEntries(
    videoSlots.map((slot) => {
      const row = byKey.get(slot.key);
      return [
        slot.key,
        row
          ? { path: row.path, title: row.altText, updatedAt: row.updatedAt }
          : { path: slot.defaultPath, title: slot.defaultTitle, updatedAt: null },
      ];
    }),
  ) as Record<VideoSlotKey, SiteVideo>;
}

export async function getPublicVideos() {
  "use cache";
  cacheTag("public-media");
  cacheLife("hours");

  return loadSiteVideos();
}

export async function getStaffVideos() {
  return loadSiteVideos();
}

export async function getPublicPhotos() {
  "use cache";
  cacheTag("public-media");
  cacheLife("hours");

  return loadSitePhotos(true);
}

export async function getStaffPhotos() {
  return loadSitePhotos(false);
}

export async function getPublicMenu() {
  "use cache";
  cacheTag("public-menu");
  cacheLife("hours");

  const categories = await db.query.menuCategory.findMany({
    where: and(eq(menuCategory.active, true)),
    orderBy: [asc(menuCategory.sortOrder), asc(menuCategory.name)],
    with: {
      items: {
        where: and(eq(menuItem.active, true), eq(menuItem.available, true)),
        orderBy: [asc(menuItem.sortOrder), asc(menuItem.name)],
      },
    },
  });

  return categories;
}

export async function getPublicEvents() {
  "use cache";
  cacheTag("public-events");
  cacheLife("minutes");

  return db.query.event.findMany({
    where: and(eq(event.status, "published"), gte(event.startsAt, new Date())),
    orderBy: [asc(event.startsAt)],
    limit: 6,
  });
}

export async function getPublicThoughts() {
  "use cache";
  cacheTag("public-thoughts");
  cacheLife("minutes");

  return db.query.guestThought.findMany({
    where: eq(guestThought.status, "published"),
    orderBy: [desc(guestThought.createdAt)],
    limit: 24,
  });
}

export async function getStaffThoughts() {
  return db.query.guestThought.findMany({
    orderBy: [desc(guestThought.createdAt)],
    limit: 200,
  });
}

export async function getStaffMenu() {
  return db.query.menuCategory.findMany({
    orderBy: [asc(menuCategory.sortOrder), asc(menuCategory.name)],
    with: {
      items: {
        orderBy: [asc(menuItem.sortOrder), asc(menuItem.name)],
      },
    },
  });
}

export async function getStaffEvents() {
  return db.query.event.findMany({
    orderBy: [desc(event.startsAt)],
  });
}

export async function getBookings() {
  return db.query.booking.findMany({
    orderBy: [desc(booking.createdAt)],
  });
}

export async function getAuditLog() {
  return db.query.auditLog.findMany({
    orderBy: [desc(auditLog.createdAt)],
    limit: 100,
    with: {
      actor: true,
    },
  });
}
