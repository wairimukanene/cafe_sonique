import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { requireStaff } from "../auth/session";
import { db } from "../db";
import { expenseReceipt } from "../db/schema";
import { OperationsError } from "./domain";

export const MAX_RECEIPT_BYTES = 750 * 1024;
const RECEIPT_ROOT = path.join(process.cwd(), ".data", "receipts");
const allowedTypes = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export type StoredReceipt = {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

function receiptPath(storageKey: string) {
  if (!/^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(storageKey)) {
    throw new OperationsError("Invalid receipt key.");
  }
  return path.join(RECEIPT_ROOT, storageKey);
}

export async function storeReceipt(file: File): Promise<StoredReceipt> {
  const extension = allowedTypes.get(file.type);
  if (!extension) {
    throw new OperationsError("Receipt must be a PDF, JPEG, PNG, or WebP file.");
  }
  if (file.size < 1 || file.size > MAX_RECEIPT_BYTES) {
    throw new OperationsError(`Receipt must be no larger than ${MAX_RECEIPT_BYTES} bytes.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storageKey = `${randomUUID()}.${extension}`;
  await mkdir(RECEIPT_ROOT, { recursive: true, mode: 0o700 });
  const handle = await open(receiptPath(storageKey), "wx", 0o600);
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }

  return {
    storageKey,
    originalName: path.basename(file.name || `receipt.${extension}`).slice(0, 255),
    mimeType: file.type,
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function deleteStoredReceipt(storageKey: string) {
  await rm(receiptPath(storageKey), { force: true });
}

export async function readReceiptSecure(receiptId: string) {
  await requireStaff();
  const record = await db.query.expenseReceipt.findFirst({
    where: eq(expenseReceipt.id, receiptId),
  });
  if (!record) return null;

  return {
    record,
    bytes: await readFile(receiptPath(record.storageKey)),
  };
}
