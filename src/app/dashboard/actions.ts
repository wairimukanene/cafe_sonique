"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";

import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { auditLog, booking, event, guestThought, menuItem } from "@/lib/db/schema";
import {
  bookingStatusSchema,
  eventSchema,
  guestThoughtStatusSchema,
  menuItemSchema,
} from "@/lib/validations";

export type ActionState = {
  ok: boolean;
  message: string;
};

const initialFailure: ActionState = {
  ok: false,
  message: "Please review the form and try again.",
};

export async function saveMenuItem(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = menuItemSchema.safeParse({
    id: formData.get("id") || undefined,
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    description: formData.get("description"),
    priceKes: formData.get("priceKes"),
    sortOrder: formData.get("sortOrder") || 0,
    available: formData.get("available") === "on",
    active: formData.get("active") === "on",
  });

  if (!parsed.success) return initialFailure;

  const id = parsed.data.id ?? crypto.randomUUID();
  const values = {
    categoryId: parsed.data.categoryId,
    name: parsed.data.name,
    description: parsed.data.description,
    priceKes: parsed.data.priceKes,
    sortOrder: parsed.data.sortOrder,
    available: parsed.data.available,
    active: parsed.data.active,
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    if (parsed.data.id) {
      await tx.update(menuItem).set(values).where(eq(menuItem.id, id));
    } else {
      await tx.insert(menuItem).values({ id, ...values });
    }

    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: staff.user.id,
      action: parsed.data.id ? "menu_item.updated" : "menu_item.created",
      entityType: "menu_item",
      entityId: id,
      metadata: { name: parsed.data.name, priceKes: parsed.data.priceKes },
    });
  });

  updateTag("public-menu");
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/menu");
  return { ok: true, message: "Menu item saved." };
}

export async function saveEvent(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const capacityValue = formData.get("capacity");
  const parsed = eventSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    startsAt: formData.get("startsAt"),
    capacity: capacityValue ? capacityValue : undefined,
    status: formData.get("status"),
  });

  if (!parsed.success) return initialFailure;

  const id = parsed.data.id ?? crypto.randomUUID();
  const values = {
    title: parsed.data.title,
    slug: parsed.data.slug,
    description: parsed.data.description,
    startsAt: parsed.data.startsAt,
    capacity: parsed.data.capacity ?? null,
    status: parsed.data.status,
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    if (parsed.data.id) {
      await tx.update(event).set(values).where(eq(event.id, id));
    } else {
      await tx.insert(event).values({ id, ...values });
    }

    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: staff.user.id,
      action: parsed.data.id ? "event.updated" : "event.created",
      entityType: "event",
      entityId: id,
      metadata: { title: parsed.data.title, status: parsed.data.status },
    });
  });

  updateTag("public-events");
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/events");
  return { ok: true, message: "Event saved." };
}

export async function updateBookingStatus(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = bookingStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    staffNotes: formData.get("staffNotes") || undefined,
  });

  if (!parsed.success) return initialFailure;

  await db.transaction(async (tx) => {
    await tx
      .update(booking)
      .set({
        status: parsed.data.status,
        staffNotes: parsed.data.staffNotes,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, parsed.data.id));

    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: staff.user.id,
      action: "booking.status_changed",
      entityType: "booking",
      entityId: parsed.data.id,
      metadata: { status: parsed.data.status },
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  return { ok: true, message: "Booking updated." };
}

export async function updateThoughtVisibility(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = guestThoughtStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) return initialFailure;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(guestThought)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(guestThought.id, parsed.data.id))
      .returning({ id: guestThought.id });

    if (!row) return null;

    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: staff.user.id,
      action: "guest_thought.visibility_changed",
      entityType: "guest_thought",
      entityId: parsed.data.id,
      metadata: { status: parsed.data.status },
    });

    return row;
  });

  if (!updated) return { ok: false, message: "That thought could not be found." };

  updateTag("public-thoughts");
  revalidatePath("/");
  revalidatePath("/dashboard/thoughts");
  return { ok: true, message: "Thought visibility updated." };
}
