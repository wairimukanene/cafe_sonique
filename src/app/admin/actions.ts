"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/app/dashboard/actions";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { auditLog, cafeSetting, mediaAsset } from "@/lib/db/schema";
import { findPhotoSlot, findVideoSlot } from "@/lib/media/slots";
import {
  deleteSitePhoto,
  SitePhotoError,
  siteVideoExists,
  storeSitePhoto,
} from "@/lib/media/storage";
import { SITE_TEXT_PREFIX, siteTextFields } from "@/lib/site-text";

const photoSchema = z.object({
  key: z.string(),
  altText: z.string().trim().min(3).max(200),
});

function refreshPhotos() {
  updateTag("public-media");
  revalidatePath("/");
  revalidatePath("/admin/photos");
}

export async function saveSitePhoto(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = photoSchema.safeParse({
    key: formData.get("key"),
    altText: formData.get("altText"),
  });
  const slot = parsed.success ? findPhotoSlot(parsed.data.key) : null;
  if (!parsed.success || !slot) {
    return { ok: false, message: "Add a short description of the photo (at least 3 characters)." };
  }

  const upload = formData.get("photo");
  const file = upload instanceof File && upload.size > 0 ? upload : null;

  let newPath: string | null = null;
  if (file) {
    try {
      newPath = await storeSitePhoto(file);
    } catch (error) {
      if (error instanceof SitePhotoError) return { ok: false, message: error.message };
      throw error;
    }
  }

  let previousPath: string | null;
  try {
    previousPath = await db.transaction(async (tx) => {
      const existing = await tx.query.mediaAsset.findFirst({
        where: eq(mediaAsset.key, slot.key),
      });
      const path = newPath ?? existing?.path ?? slot.defaultPath;
      if (!path) throw new SitePhotoError("Choose a photo first.");

      if (existing) {
        await tx
          .update(mediaAsset)
          .set({ path, altText: parsed.data.altText, approved: true, updatedAt: new Date() })
          .where(eq(mediaAsset.id, existing.id));
      } else {
        await tx.insert(mediaAsset).values({
          id: crypto.randomUUID(),
          key: slot.key,
          path,
          altText: parsed.data.altText,
          approved: true,
        });
      }

      await tx.insert(auditLog).values({
        id: crypto.randomUUID(),
        actorId: staff.user.id,
        action: newPath ? "media_asset.replaced" : "media_asset.updated",
        entityType: "media_asset",
        entityId: slot.key,
        metadata: { path },
      });

      return existing?.path ?? null;
    });
  } catch (error) {
    if (newPath) await deleteSitePhoto(newPath);
    if (error instanceof SitePhotoError) return { ok: false, message: error.message };
    throw error;
  }

  if (newPath && previousPath && previousPath !== newPath) {
    await deleteSitePhoto(previousPath);
  }

  refreshPhotos();
  return { ok: true, message: newPath ? "Photo updated on the website." : "Description saved." };
}

export async function removeSitePhoto(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const slot = findPhotoSlot(String(formData.get("key")));
  if (!slot) return { ok: false, message: "Unknown photo." };

  const removedPath = await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(mediaAsset)
      .where(eq(mediaAsset.key, slot.key))
      .returning({ path: mediaAsset.path });
    if (!row) return null;

    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: staff.user.id,
      action: "media_asset.removed",
      entityType: "media_asset",
      entityId: slot.key,
      metadata: { path: row.path },
    });
    return row.path;
  });

  if (removedPath) await deleteSitePhoto(removedPath);

  refreshPhotos();
  return {
    ok: true,
    message: slot.defaultPath ? "Back to the original photo." : "Photo removed from the website.",
  };
}

const videoSchema = z.object({
  key: z.string(),
  title: z.string().trim().min(3).max(200),
  path: z.string().optional(),
});

export async function saveSiteVideo(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = videoSchema.safeParse({
    key: formData.get("key"),
    title: formData.get("title"),
    path: formData.get("path") || undefined,
  });
  const slot = parsed.success ? findVideoSlot(parsed.data.key) : null;
  if (!parsed.success || !slot) {
    return { ok: false, message: "Add a short description of the video (at least 3 characters)." };
  }

  const newPath = parsed.data.path ?? null;
  if (newPath && !(await siteVideoExists(newPath))) {
    return { ok: false, message: "The upload did not finish. Please try again." };
  }

  const existing = await db.query.mediaAsset.findFirst({ where: eq(mediaAsset.key, slot.key) });
  const path = newPath ?? existing?.path ?? slot.defaultPath;
  if (!path) return { ok: false, message: "Choose a video first." };

  await db.transaction(async (tx) => {
    if (existing) {
      await tx
        .update(mediaAsset)
        .set({ path, altText: parsed.data.title, approved: true, updatedAt: new Date() })
        .where(eq(mediaAsset.id, existing.id));
    } else {
      await tx.insert(mediaAsset).values({
        id: crypto.randomUUID(),
        key: slot.key,
        path,
        altText: parsed.data.title,
        approved: true,
      });
    }

    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: staff.user.id,
      action: newPath ? "media_asset.replaced" : "media_asset.updated",
      entityType: "media_asset",
      entityId: slot.key,
      metadata: { path },
    });
  });

  if (newPath && existing?.path && existing.path !== newPath) {
    await deleteSitePhoto(existing.path);
  }

  updateTag("public-media");
  revalidatePath("/");
  revalidatePath("/admin/videos");
  return { ok: true, message: newPath ? "Video is live on the website." : "Description saved." };
}

export async function removeSiteVideo(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const slot = findVideoSlot(String(formData.get("key")));
  if (!slot) return { ok: false, message: "Unknown video." };

  const removedPath = await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(mediaAsset)
      .where(eq(mediaAsset.key, slot.key))
      .returning({ path: mediaAsset.path });
    if (!row) return null;

    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: staff.user.id,
      action: "media_asset.removed",
      entityType: "media_asset",
      entityId: slot.key,
      metadata: { path: row.path },
    });
    return row.path;
  });

  if (removedPath) await deleteSitePhoto(removedPath);

  updateTag("public-media");
  revalidatePath("/");
  revalidatePath("/admin/videos");
  return {
    ok: true,
    message: slot.defaultPath ? "Back to the original video." : "Video removed. The cover photo shows instead.",
  };
}

export async function saveSiteText(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const values: { key: string; value: string }[] = [];

  for (const field of siteTextFields) {
    const raw = formData.get(field.key);
    if (typeof raw !== "string") continue;
    const value = raw.replace(/\r\n/g, "\n").trim();
    if (value.length > field.maxLength) {
      return { ok: false, message: `“${field.label}” is too long (maximum ${field.maxLength} characters).` };
    }
    values.push({ key: `${SITE_TEXT_PREFIX}${field.key}`, value });
  }

  if (!values.length) return { ok: false, message: "Nothing to save." };

  await db.transaction(async (tx) => {
    await tx
      .insert(cafeSetting)
      .values(values.map(({ key, value }) => ({ key, value, updatedBy: staff.user.id, updatedAt: new Date() })))
      .onConflictDoUpdate({
        target: cafeSetting.key,
        set: {
          value: sql`excluded.value`,
          updatedBy: sql`excluded.updated_by`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      actorId: staff.user.id,
      action: "site_text.updated",
      entityType: "site_text",
      entityId: "site_text",
      metadata: { keys: values.map(({ key }) => key) },
    });
  });

  updateTag("public-site-text");
  revalidatePath("/");
  revalidatePath("/admin/words");
  return { ok: true, message: "Saved. The website is updated." };
}
