"use server";

import { headers } from "next/headers";
import { sql } from "drizzle-orm";

import {
  bookingLimitExceeded,
  bookingRateLimitKey,
} from "@/lib/bookings/rate-limit";
import { db } from "@/lib/db";
import { booking, rateLimit } from "@/lib/db/schema";
import { bookingSchema } from "@/lib/validations";

export type BookingFormState = {
  ok: boolean;
  message: string;
};

export async function submitBooking(
  _state: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  if (formData.get("website")) {
    return { ok: true, message: "Thanks. We’ll be in touch soon." };
  }

  const parsed = bookingSchema.safeParse({
    name: formData.get("name"),
    contact: formData.get("contact"),
    eventType: formData.get("eventType"),
    preferredDate: formData.get("preferredDate"),
    attendeeCount: formData.get("attendeeCount") || 1,
    message: formData.get("message") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review your details.",
    };
  }

  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded ?? requestHeaders.get("x-real-ip") ?? "local";
  const key = bookingRateLimitKey(ip);

  const [limit] = await db
    .insert(rateLimit)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: { count: sql`${rateLimit.count} + 1` },
    })
    .returning({ count: rateLimit.count });

  if (bookingLimitExceeded(limit.count)) {
    return {
      ok: false,
      message: "Too many requests. Please try again in an hour.",
    };
  }

  await db.insert(booking).values({
    id: crypto.randomUUID(),
    name: parsed.data.name,
    contact: parsed.data.contact,
    eventType: parsed.data.eventType,
    preferredDate: parsed.data.preferredDate,
    attendeeCount: parsed.data.attendeeCount,
    message: parsed.data.message,
  });

  return {
    ok: true,
    message: "Your enquiry is in. The Sonique team will contact you soon.",
  };
}
