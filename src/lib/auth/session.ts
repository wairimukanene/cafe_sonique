import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "../auth";
import { toStaffRole } from "./roles";

export async function getStaffSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireStaff() {
  const current = await getStaffSession();

  if (!current) {
    redirect("/login");
  }

  const role = toStaffRole(current.user.role);

  if (!role) {
    redirect("/login");
  }

  return {
    ...current,
    user: {
      ...current.user,
      role,
    },
  };
}

export async function requireOwner() {
  const current = await requireStaff();

  if (current.user.role !== "owner") {
    redirect("/dashboard");
  }

  return current;
}
