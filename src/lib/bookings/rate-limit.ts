import { createHash } from "node:crypto";

export const BOOKING_REQUEST_LIMIT = 5;

export function bookingRateLimitKey(ip: string, now = Date.now()) {
  const hour = Math.floor(now / 3_600_000);
  const hash = createHash("sha256").update(`${ip}:${hour}`).digest("hex");
  return `booking:${hour}:${hash}`;
}

export function bookingLimitExceeded(count: number) {
  return count > BOOKING_REQUEST_LIMIT;
}
