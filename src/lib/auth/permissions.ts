import type { StaffRole } from "@/lib/auth-core";

export type StaffCapability =
  | "record_sale"
  | "record_expense"
  | "record_stock_movement"
  | "manage_content"
  | "void_financial_record"
  | "reconcile_mpesa"
  | "view_financial_reports"
  | "configure_inventory"
  | "configure_loyalty";

const baristaCapabilities = new Set<StaffCapability>([
  "record_sale",
  "record_expense",
  "record_stock_movement",
  "manage_content",
]);

export function hasCapability(role: StaffRole, capability: StaffCapability) {
  return role === "owner" || baristaCapabilities.has(capability);
}

export function assertCapability(role: StaffRole, capability: StaffCapability) {
  if (!hasCapability(role, capability)) {
    throw new Error(`The ${role} role cannot perform ${capability}.`);
  }
}
