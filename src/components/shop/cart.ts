"use client";

import { useSyncExternalStore } from "react";

export type CartLine = { optionId: string; quantity: number };

const STORAGE_KEY = "sonique-bag-v1";
const MAX_QUANTITY = 20;
const EMPTY: CartLine[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedLines: CartLine[] = EMPTY;

function parse(raw: string | null): CartLine[] {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return EMPTY;
    return value.flatMap((line) =>
      line &&
      typeof line.optionId === "string" &&
      Number.isInteger(line.quantity) &&
      line.quantity > 0
        ? [{ optionId: line.optionId, quantity: Math.min(line.quantity, MAX_QUANTITY) }]
        : [],
    );
  } catch {
    return EMPTY;
  }
}

function getSnapshot() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedLines = parse(raw);
  }
  return cachedLines;
}

function getServerSnapshot() {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function write(lines: CartLine[]) {
  const cleaned = lines.filter((line) => line.quantity > 0);
  if (cleaned.length) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  for (const listener of listeners) listener();
}

export function useCart() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useCartCount() {
  return useCart().reduce((sum, line) => sum + line.quantity, 0);
}

export function addToCart(optionId: string, quantity = 1) {
  const lines = getSnapshot();
  if (lines.some((line) => line.optionId === optionId)) {
    write(
      lines.map((line) =>
        line.optionId === optionId
          ? { ...line, quantity: Math.min(line.quantity + quantity, MAX_QUANTITY) }
          : line,
      ),
    );
  } else {
    write([...lines, { optionId, quantity: Math.min(quantity, MAX_QUANTITY) }]);
  }
}

export function setCartQuantity(optionId: string, quantity: number) {
  write(
    getSnapshot().map((line) =>
      line.optionId === optionId
        ? { ...line, quantity: Math.max(0, Math.min(quantity, MAX_QUANTITY)) }
        : line,
    ),
  );
}

export function removeFromCart(optionId: string) {
  write(getSnapshot().filter((line) => line.optionId !== optionId));
}

export function clearCart() {
  write([]);
}

export function formatKes(amount: number) {
  return `KES ${amount.toLocaleString("en-KE")}`;
}
