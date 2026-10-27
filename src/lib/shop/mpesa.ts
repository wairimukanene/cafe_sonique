import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { darajaPhone, nairobiTimestamp, stkPassword } from "./domain";

const SANDBOX_URL = "https://sandbox.safaricom.co.ke";
const PRODUCTION_URL = "https://api.safaricom.co.ke";

const modeSchema = z.enum(["off", "mock", "sandbox", "production"]);
export type MpesaMode = z.infer<typeof modeSchema>;

const liveConfigSchema = z.object({
  consumerKey: z.string().min(10),
  consumerSecret: z.string().min(10),
  passkey: z.string().min(10),
  shortCode: z.string().regex(/^\d{5,10}$/),
  partyB: z.string().regex(/^\d{5,10}$/),
  transactionType: z.enum(["CustomerBuyGoodsOnline", "CustomerPayBillOnline"]),
  callbackUrl: z
    .string()
    .url()
    .startsWith("https://")
    .refine((url) => !/mpesa|safaricom|query/i.test(url), {
      message: "Safaricom rejects callback addresses containing mpesa, safaricom or query.",
    }),
});

type LiveConfig = z.infer<typeof liveConfigSchema>;

export type MpesaStatus = {
  mode: MpesaMode;
  ready: boolean;
  problem: string | null;
  tillNumber: string | null;
};

function readMode(): MpesaMode {
  const parsed = modeSchema.safeParse((process.env.MPESA_ENV ?? "off").trim().toLowerCase());
  const mode = parsed.success ? parsed.data : "off";
  if (mode === "mock" && process.env.NODE_ENV === "production" && process.env.MPESA_ALLOW_MOCK !== "true") {
    return "off";
  }
  return mode;
}

function callbackUrl() {
  const base = process.env.MPESA_CALLBACK_BASE_URL?.trim().replace(/\/+$/, "");
  const secret = process.env.MPESA_CALLBACK_SECRET?.trim();
  if (!base || !secret) return "";
  return `${base}/api/payments/callback/${secret}`;
}

const envNames: Record<keyof LiveConfig, string> = {
  consumerKey: "MPESA_CONSUMER_KEY",
  consumerSecret: "MPESA_CONSUMER_SECRET",
  passkey: "MPESA_PASSKEY",
  shortCode: "MPESA_SHORTCODE",
  partyB: "MPESA_TILL_NUMBER",
  transactionType: "MPESA_TRANSACTION_TYPE",
  callbackUrl: "MPESA_CALLBACK_BASE_URL",
};

function readLiveConfig(): { config: LiveConfig | null; problem: string | null } {
  const parsed = liveConfigSchema.safeParse({
    consumerKey: process.env.MPESA_CONSUMER_KEY?.trim(),
    consumerSecret: process.env.MPESA_CONSUMER_SECRET?.trim(),
    passkey: process.env.MPESA_PASSKEY?.trim(),
    shortCode: process.env.MPESA_SHORTCODE?.trim(),
    partyB: (process.env.MPESA_TILL_NUMBER ?? process.env.MPESA_SHORTCODE)?.trim(),
    transactionType: process.env.MPESA_TRANSACTION_TYPE?.trim() || "CustomerBuyGoodsOnline",
    callbackUrl: callbackUrl(),
  });
  if (parsed.success) return { config: parsed.data, problem: null };
  const issue = parsed.error.issues[0];
  const setting = envNames[String(issue?.path[0]) as keyof LiveConfig] ?? "an M-Pesa setting";
  const detail = issue?.code === "custom" ? ` ${issue.message}` : "";
  return { config: null, problem: `Server setting ${setting} is missing or invalid.${detail}` };
}

export function callbackSecretMatches(candidate: string) {
  const secret = process.env.MPESA_CALLBACK_SECRET?.trim();
  if (!secret || secret.length < 24) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function getMpesaStatus(): MpesaStatus {
  const mode = readMode();
  if (mode === "off") {
    return { mode, ready: false, problem: "Online payments are switched off.", tillNumber: null };
  }
  if (mode === "mock") {
    return { mode, ready: true, problem: null, tillNumber: "000000" };
  }
  if (!process.env.MPESA_CALLBACK_SECRET || process.env.MPESA_CALLBACK_SECRET.trim().length < 24) {
    return { mode, ready: false, problem: "Server setting MPESA_CALLBACK_SECRET must be at least 24 characters.", tillNumber: null };
  }
  const { config, problem } = readLiveConfig();
  if (!config) return { mode, ready: false, problem, tillNumber: null };
  return { mode, ready: true, problem: null, tillNumber: config.partyB };
}

export class MpesaRequestError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "MpesaRequestError";
  }
}

let cachedToken: { value: string; expiresAt: number; key: string } | null = null;

function baseUrl(mode: MpesaMode) {
  return mode === "production" ? PRODUCTION_URL : SANDBOX_URL;
}

async function darajaFetch(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch {
    throw new MpesaRequestError("M-Pesa could not be reached. Please try again.", true);
  } finally {
    clearTimeout(timer);
  }
}

async function accessToken(mode: MpesaMode, config: LiveConfig) {
  const key = `${mode}:${config.consumerKey}`;
  if (cachedToken && cachedToken.key === key && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const response = await darajaFetch(`${baseUrl(mode)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  const body = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: string | number }
    | null;
  if (!response.ok || !body?.access_token) {
    throw new MpesaRequestError("M-Pesa sign-in failed. Check the consumer key and secret.", false);
  }
  cachedToken = {
    key,
    value: body.access_token,
    expiresAt: Date.now() + Number(body.expires_in ?? 3599) * 1000,
  };
  return body.access_token;
}

export type StkPushRequest = {
  phoneE164: string;
  amountKes: number;
  accountReference: string;
  description: string;
};

export type StkPushResponse = {
  merchantRequestId: string | null;
  checkoutRequestId: string;
  customerMessage: string;
};

export async function sendStkPush(request: StkPushRequest): Promise<StkPushResponse> {
  const status = getMpesaStatus();
  if (!status.ready) throw new MpesaRequestError(status.problem ?? "M-Pesa is not configured.", false);

  if (status.mode === "mock") {
    return {
      merchantRequestId: `mock-${randomUUID()}`,
      checkoutRequestId: `ws_CO_MOCK_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
      customerMessage: "Success. Request accepted for processing",
    };
  }

  const { config } = readLiveConfig();
  if (!config) throw new MpesaRequestError("M-Pesa is not configured.", false);
  const token = await accessToken(status.mode, config);
  const timestamp = nairobiTimestamp();
  const phone = darajaPhone(request.phoneE164);
  const response = await darajaFetch(`${baseUrl(status.mode)}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: config.shortCode,
      Password: stkPassword(config.shortCode, config.passkey, timestamp),
      Timestamp: timestamp,
      TransactionType: config.transactionType,
      Amount: request.amountKes,
      PartyA: phone,
      PartyB: config.partyB,
      PhoneNumber: phone,
      CallBackURL: config.callbackUrl,
      AccountReference: request.accountReference.slice(0, 12),
      TransactionDesc: request.description.slice(0, 13),
    }),
  });
  const body = (await response.json().catch(() => null)) as Record<string, string> | null;
  if (!response.ok || body?.ResponseCode !== "0" || !body.CheckoutRequestID) {
    const reason = body?.errorMessage ?? body?.ResponseDescription ?? `HTTP ${response.status}`;
    console.error("M-Pesa STK push rejected:", reason);
    throw new MpesaRequestError(
      "M-Pesa couldn't send the payment prompt. Check the phone number and try again.",
      response.status >= 500,
    );
  }
  return {
    merchantRequestId: body.MerchantRequestID ?? null,
    checkoutRequestId: body.CheckoutRequestID,
    customerMessage: body.CustomerMessage ?? "",
  };
}

// Daraja answers a status query with 4999 while the customer hasn't finished the prompt yet.
const STILL_PROCESSING_CODES = new Set([4999]);

export type StkQueryResult =
  | { state: "processing" }
  | { state: "done"; resultCode: number; resultDesc: string };

export async function queryStkPush(checkoutRequestId: string): Promise<StkQueryResult> {
  const status = getMpesaStatus();
  if (!status.ready || status.mode === "mock") return { state: "processing" };

  const { config } = readLiveConfig();
  if (!config) return { state: "processing" };
  const token = await accessToken(status.mode, config);
  const timestamp = nairobiTimestamp();
  const response = await darajaFetch(`${baseUrl(status.mode)}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: config.shortCode,
      Password: stkPassword(config.shortCode, config.passkey, timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  const body = (await response.json().catch(() => null)) as Record<string, string> | null;
  if (!body || body.ResultCode === undefined) return { state: "processing" };
  const resultCode = Number(body.ResultCode);
  if (!Number.isFinite(resultCode) || STILL_PROCESSING_CODES.has(resultCode)) return { state: "processing" };
  return {
    state: "done",
    resultCode,
    resultDesc: String(body.ResultDesc ?? ""),
  };
}
