import { z } from "zod";

export const menuItemSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(3).max(240),
  priceKes: z.coerce.number().int().min(0).max(100_000),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  available: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(false),
});

export const eventSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3).max(120),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(140),
  description: z.string().trim().min(10).max(2_000),
  startsAt: z.coerce.date(),
  capacity: z.coerce.number().int().min(1).max(500).optional(),
  status: z.enum(["draft", "published", "archived"]),
});

export const bookingSchema = z.object({
  name: z.string().trim().min(2).max(100),
  contact: z.string().trim().min(5).max(160),
  eventType: z.string().trim().min(2).max(100),
  preferredDate: z.coerce.date().refine((date) => date > new Date(), {
    message: "Choose a future date.",
  }),
  attendeeCount: z.coerce.number().int().min(1).max(100).default(1),
  message: z.string().trim().max(1_000).optional(),
  website: z.string().max(0).optional(),
});

export const guestThoughtSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  body: z.string().trim().min(8).max(280),
});

export const guestThoughtStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["published", "hidden"]),
});

export const bookingStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["new", "contacted", "confirmed", "declined", "cancelled"]),
  staffNotes: z.string().trim().max(2_000).optional(),
});
