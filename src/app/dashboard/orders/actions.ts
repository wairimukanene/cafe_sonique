"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/app/dashboard/actions";
import { requireStaff } from "@/lib/auth/session";
import { ShopError } from "@/lib/shop/domain";
import { cancelOrder, moveOrder, PUBLIC_SHOP_TAG } from "@/lib/shop/service";

const moveSchema = z.object({
  id: z.string().min(1).max(200),
  to: z.enum(["ready_for_pickup", "out_for_delivery", "completed"]),
});

const cancelSchema = z.object({
  id: z.string().min(1).max(200),
  reason: z.string().trim().min(3, "Add a short reason for cancelling.").max(300),
});

function refreshOrders() {
  updateTag(PUBLIC_SHOP_TAG);
  revalidatePath("/dashboard/orders");
}

export async function advanceShopOrder(_state: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = moveSchema.safeParse({ id: formData.get("id"), to: formData.get("to") });
  if (!parsed.success) return { ok: false, message: "Please refresh the page and try again." };

  try {
    await moveOrder(parsed.data.id, parsed.data.to, { id: staff.user.id, role: staff.user.role });
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  refreshOrders();
  return { ok: true, message: "Order updated." };
}

export async function cancelShopOrder(_state: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = cancelSchema.safeParse({ id: formData.get("id"), reason: formData.get("reason") });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please review the form and try again." };
  }

  try {
    await cancelOrder(parsed.data.id, parsed.data.reason, { id: staff.user.id, role: staff.user.role });
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  refreshOrders();
  return { ok: true, message: "Order cancelled and stock put back." };
}
