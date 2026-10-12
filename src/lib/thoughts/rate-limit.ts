import { createHash } from "node:crypto";

export const THOUGHT_REQUEST_LIMIT = 3;

export function thoughtRateLimitKey(ip: string, now = Date.now()) {
  const hour = Math.floor(now / 3_600_000);
  const hash = createHash("sha256").update(`${ip}:${hour}`).digest("hex");
  return `thought:${hour}:${hash}`;
}

export function thoughtLimitExceeded(count: number) {
  return count > THOUGHT_REQUEST_LIMIT;
}
