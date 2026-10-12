import "server-only";

import { and, asc, desc, eq, gte } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";
import {
  auditLog,
  booking,
  event,
  guestThought,
  menuCategory,
  menuItem,
} from "@/lib/db/schema";

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
