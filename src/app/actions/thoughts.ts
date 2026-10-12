"use server";

import { headers } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { guestThought, rateLimit } from "@/lib/db/schema";
import {
  thoughtLimitExceeded,
  thoughtRateLimitKey,
} from "@/lib/thoughts/rate-limit";
import { guestThoughtSchema } from "@/lib/validations";

export type ThoughtFormState = {
  ok: boolean;
  message: string;
};

export async function submitThought(
  _state: ThoughtFormState,
  formData: FormData,
): Promise<ThoughtFormState> {
  if (formData.get("website")) {
    return { ok: true, message: "Your thought is on the wall." };
  }

  const parsed = guestThoughtSchema.safeParse({
    displayName: formData.get("displayName"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review your thought.",
    };
  }

  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded ?? requestHeaders.get("x-real-ip") ?? "local";
  const key = thoughtRateLimitKey(ip);

  const [limit] = await db
    .insert(rateLimit)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: { count: sql`${rateLimit.count} + 1` },
    })
    .returning({ count: rateLimit.count });

  if (thoughtLimitExceeded(limit.count)) {
    return {
      ok: false,
      message: "Too many thoughts from this connection. Please try again in an hour.",
    };
  }

  await db.insert(guestThought).values({
    id: crypto.randomUUID(),
    displayName: parsed.data.displayName,
    body: parsed.data.body,
    status: "published",
  });

  updateTag("public-thoughts");
  revalidatePath("/");
  revalidatePath("/dashboard/thoughts");

  return {
    ok: true,
    message: "Your thought is on the wall.",
  };
}
