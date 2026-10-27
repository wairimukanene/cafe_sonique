"use server";

import { headers } from "next/headers";

import { checkoutSchema, ShopError } from "@/lib/shop/domain";
import { MpesaRequestError } from "@/lib/shop/mpesa";
import { placeOrder, retryPaymentByToken } from "@/lib/shop/service";

export type CheckoutResult =
  | { ok: true; token: string }
  | { ok: false; message: string; field?: string };

async function clientIp() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip") || "local";
}

export async function placeShopOrder(payload: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      message: issue?.message ?? "Please check your details.",
      field: issue?.path[0] ? String(issue.path[0]) : undefined,
    };
  }

  try {
    const order = await placeOrder(parsed.data, await clientIp());
    return { ok: true, token: order.token };
  } catch (error) {
    if (error instanceof ShopError || error instanceof MpesaRequestError) {
      return { ok: false, message: error.message };
    }
    console.error("Checkout failed:", error);
    return { ok: false, message: "Something went wrong placing your order. Please try again." };
  }
}

export async function resendPaymentPrompt(token: string): Promise<{ ok: boolean; message: string }> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return { ok: false, message: "Order not found." };
  }
  try {
    await retryPaymentByToken(token);
    return { ok: true, message: "We've sent a new prompt to your phone." };
  } catch (error) {
    if (error instanceof ShopError || error instanceof MpesaRequestError) {
      return { ok: false, message: error.message };
    }
    console.error("Payment prompt failed:", error);
    return { ok: false, message: "We couldn't send the prompt. Please try again." };
  }
}
