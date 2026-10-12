import { describe, expect, it } from "vitest";

import { isOwner, toStaffRole } from "../src/lib/auth/roles";
import {
  BOOKING_REQUEST_LIMIT,
  bookingLimitExceeded,
  bookingRateLimitKey,
} from "../src/lib/bookings/rate-limit";
import {
  THOUGHT_REQUEST_LIMIT,
  thoughtLimitExceeded,
  thoughtRateLimitKey,
} from "../src/lib/thoughts/rate-limit";
import {
  bookingSchema,
  bookingStatusSchema,
  guestThoughtSchema,
  menuItemSchema,
} from "../src/lib/validations";

describe("staff roles", () => {
  it("recognises only supported roles", () => {
    expect(toStaffRole("owner")).toBe("owner");
    expect(toStaffRole(["barista"])).toBe("barista");
    expect(toStaffRole("customer")).toBeNull();
    expect(isOwner("barista")).toBe(false);
    expect(isOwner("owner")).toBe(true);
  });
});

describe("booking controls", () => {
  it("creates stable, privacy-safe hourly rate-limit keys", () => {
    const now = Date.UTC(2026, 9, 10, 9);
    expect(bookingRateLimitKey("192.0.2.1", now)).toBe(
      bookingRateLimitKey("192.0.2.1", now + 30_000),
    );
    expect(bookingRateLimitKey("192.0.2.1", now)).not.toContain("192.0.2.1");
    expect(bookingLimitExceeded(BOOKING_REQUEST_LIMIT)).toBe(false);
    expect(bookingLimitExceeded(BOOKING_REQUEST_LIMIT + 1)).toBe(true);
  });

  it("rejects past booking dates and invalid statuses", () => {
    expect(
      bookingSchema.safeParse({
        name: "Guest",
        contact: "guest@example.com",
        eventType: "Listening session",
        preferredDate: "2020-01-01",
        attendeeCount: 2,
      }).success,
    ).toBe(false);
    expect(bookingStatusSchema.safeParse({ id: "1", status: "deleted" }).success).toBe(false);
  });
});

describe("guest thoughts", () => {
  it("keeps public notes short and rate-limited", () => {
    expect(
      guestThoughtSchema.safeParse({
        displayName: "Amina",
        body: "The Mont Blanc and the records made the afternoon.",
      }).success,
    ).toBe(true);
    expect(guestThoughtSchema.safeParse({ displayName: "A", body: "short" }).success).toBe(false);
    const now = Date.UTC(2026, 9, 10, 9);
    expect(thoughtRateLimitKey("192.0.2.1", now)).not.toContain("192.0.2.1");
    expect(thoughtLimitExceeded(THOUGHT_REQUEST_LIMIT)).toBe(false);
    expect(thoughtLimitExceeded(THOUGHT_REQUEST_LIMIT + 1)).toBe(true);
  });
});

describe("menu validation", () => {
  it("accepts valid KES prices and rejects negative prices", () => {
    const base = {
      categoryId: "cat-espresso",
      name: "Espresso",
      description: "Double shot",
      sortOrder: 1,
      available: true,
      active: true,
    };

    expect(menuItemSchema.safeParse({ ...base, priceKes: 250 }).success).toBe(true);
    expect(menuItemSchema.safeParse({ ...base, priceKes: -1 }).success).toBe(false);
  });
});
