export type DisplayRecord = Record<string, unknown>;

export function records(value: unknown, keys: string[]): DisplayRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of keys) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }
  return [];
}

export function nestedRecords(
  value: unknown,
  parentKeys: string[],
  childKeys: string[],
): DisplayRecord[] {
  if (!isRecord(value)) return [];
  for (const parentKey of parentKeys) {
    const parent = value[parentKey];
    const result = records(parent, childKeys);
    if (result.length) return result;
  }
  return [];
}

export function text(value: unknown, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return fallback;
}

export function money(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? `KES ${amount.toLocaleString("en-KE")}` : "—";
}

export function dateTime(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.valueOf())
    ? "—"
    : date.toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
}

export function first(record: DisplayRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function isRecord(value: unknown): value is DisplayRecord {
  return typeof value === "object" && value !== null;
}
