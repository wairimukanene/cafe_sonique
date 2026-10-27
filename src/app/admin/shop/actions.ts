"use server";

import { revalidatePath, updateTag } from "next/cache";

import type { ActionState } from "@/app/dashboard/actions";
import { requireOwner, requireStaff } from "@/lib/auth/session";
import { deleteSitePhoto, SitePhotoError, storeSitePhoto } from "@/lib/media/storage";
import { deliveryAreaSchema, productSchema, ShopError } from "@/lib/shop/domain";
import { PUBLIC_SHOP_TAG, saveDeliveryArea, saveProduct } from "@/lib/shop/service";

function refreshShop() {
  updateTag(PUBLIC_SHOP_TAG);
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin/shop");
}

function readOptions(formData: FormData) {
  const ids = formData.getAll("optionId").map(String);
  const colours = formData.getAll("optionColour").map(String);
  const labels = formData.getAll("optionLabel").map(String);
  const stocks = formData.getAll("optionStock").map(String);
  return labels.flatMap((label, index) =>
    label.trim() || ids[index]
      ? [{ id: ids[index] || undefined, colourKey: colours[index] || undefined, label, stock: stocks[index] ?? "0" }]
      : [],
  );
}

function readColours(formData: FormData) {
  const keys = formData.getAll("colourKey").map(String);
  const ids = formData.getAll("colourId").map(String);
  const names = formData.getAll("colourName").map(String);
  return keys.map((key, index) => ({ key, id: ids[index] || undefined, name: names[index] ?? "" }));
}

function uploadedFile(value: FormDataEntryValue | null) {
  return value instanceof File && value.size > 0 ? value : null;
}

export async function saveShopProduct(_state: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = productSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: formData.get("description"),
    priceKes: formData.get("priceKes"),
    imageAlt: formData.get("imageAlt") ?? "",
    featured: formData.get("featured") === "on",
    active: formData.get("active") === "on",
    sortOrder: formData.get("sortOrder") || 0,
    colours: readColours(formData),
    options: readOptions(formData),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please review the form and try again." };
  }

  const file = uploadedFile(formData.get("photo"));
  const isOwner = staff.user.role === "owner";
  const colourFiles = parsed.data.colours.flatMap((colour) => {
    if (!isOwner && !colour.id) return [];
    const colourFile = uploadedFile(formData.get(`colourPhoto:${colour.key}`));
    return colourFile ? [[colour.key, colourFile] as const] : [];
  });
  let newPath: string | null = null;
  const colourPhotos: Record<string, string> = {};
  const stored: string[] = [];
  try {
    if (file) {
      newPath = await storeSitePhoto(file);
      stored.push(newPath);
    }
    for (const [key, colourFile] of colourFiles) {
      colourPhotos[key] = await storeSitePhoto(colourFile);
      stored.push(colourPhotos[key]);
    }
  } catch (error) {
    await Promise.all(stored.map(deleteSitePhoto));
    if (error instanceof SitePhotoError) return { ok: false, message: error.message };
    throw error;
  }

  let replacedPaths: string[];
  try {
    ({ replacedPaths } = await saveProduct(parsed.data, newPath, colourPhotos, {
      id: staff.user.id,
      role: staff.user.role,
    }));
  } catch (error) {
    await Promise.all(stored.map(deleteSitePhoto));
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }

  await Promise.all(replacedPaths.map(deleteSitePhoto));

  refreshShop();
  return {
    ok: true,
    message: parsed.data.id ? "Saved. The shop is updated." : "Product added to the shop.",
  };
}

export async function saveShopDeliveryArea(_state: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner();
  const parsed = deliveryAreaSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    feeKes: formData.get("feeKes"),
    sortOrder: formData.get("sortOrder") || 0,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please review the form and try again." };
  }

  try {
    await saveDeliveryArea(parsed.data, { id: owner.user.id, role: owner.user.role });
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }

  refreshShop();
  return { ok: true, message: parsed.data.id ? "Delivery area saved." : "Delivery area added." };
}
