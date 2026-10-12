import type { StaffRole } from "@/lib/auth-core";

export function toStaffRole(role: string | string[] | null | undefined): StaffRole | null {
  const value = Array.isArray(role) ? role[0] : role;
  return value === "owner" || value === "barista" ? value : null;
}

export function isOwner(role: string | string[] | null | undefined) {
  return toStaffRole(role) === "owner";
}
