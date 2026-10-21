import "server-only";

import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  detectImageType,
  detectVideoType,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  type SitePhotoType,
  type SiteVideoType,
} from "./slots";

const MEDIA_ROOT = path.join(process.cwd(), ".data", "media");
const PUBLIC_PREFIX = "/media/";
const fileNamePattern = /^[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov|webm)$/;
const videoPathPattern = /^\/media\/[0-9a-f-]{36}\.(mp4|mov|webm)$/;

const contentTypes: Record<SitePhotoType | SiteVideoType, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export class SitePhotoError extends Error {}

function mediaPath(fileName: string) {
  if (!fileNamePattern.test(fileName)) {
    throw new SitePhotoError("Invalid media name.");
  }
  return path.join(MEDIA_ROOT, fileName);
}

export async function storeSitePhoto(file: File) {
  if (file.size < 1 || file.size > MAX_PHOTO_BYTES) {
    throw new SitePhotoError("That photo is too large. Please choose a smaller one.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    throw new SitePhotoError("Photos must be JPEG, PNG or WebP images.");
  }

  const fileName = `${randomUUID()}.${type}`;
  await mkdir(MEDIA_ROOT, { recursive: true });
  const handle = await open(mediaPath(fileName), "wx", 0o644);
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }

  return `${PUBLIC_PREFIX}${fileName}`;
}

export async function storeSiteVideo(body: ReadableStream<Uint8Array>) {
  const id = randomUUID();
  await mkdir(MEDIA_ROOT, { recursive: true });
  const partialPath = path.join(MEDIA_ROOT, `${id}.part`);
  const handle = await open(partialPath, "wx", 0o644);
  const head: number[] = [];
  let size = 0;

  try {
    for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.byteLength;
      if (size > MAX_VIDEO_BYTES) {
        throw new SitePhotoError("That video is too large. Please keep it under 250 MB.");
      }
      if (head.length < 16) head.push(...chunk.subarray(0, 16 - head.length));
      await handle.write(chunk);
    }
  } catch (error) {
    await handle.close();
    await rm(partialPath, { force: true });
    throw error;
  }
  await handle.close();

  const type = detectVideoType(Uint8Array.from(head));
  if (!type || size < 1) {
    await rm(partialPath, { force: true });
    throw new SitePhotoError("Videos must be MP4, MOV or WebM files.");
  }

  const fileName = `${id}.${type}`;
  await rename(partialPath, mediaPath(fileName));
  return `${PUBLIC_PREFIX}${fileName}`;
}

export async function siteVideoExists(publicPath: string) {
  if (!videoPathPattern.test(publicPath)) return false;
  try {
    return (await stat(mediaPath(publicPath.slice(PUBLIC_PREFIX.length)))).isFile();
  } catch {
    return false;
  }
}

export async function deleteSitePhoto(publicPath: string) {
  if (!publicPath.startsWith(PUBLIC_PREFIX)) return;
  await rm(mediaPath(publicPath.slice(PUBLIC_PREFIX.length)), { force: true });
}

export async function openSiteMedia(fileName: string, rangeHeader: string | null) {
  if (!fileNamePattern.test(fileName)) return null;

  let size: number;
  try {
    size = (await stat(mediaPath(fileName))).size;
  } catch {
    return null;
  }

  const type = fileName.split(".").pop() as SitePhotoType | SiteVideoType;
  const contentType = contentTypes[type];
  const match = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0;
  let end = size - 1;
  let partial = false;

  if (match && (match[1] || match[2])) {
    partial = true;
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    } else {
      start = Math.max(size - Number(match[2]), 0);
    }
    if (start > end || start >= size) {
      return { status: 416 as const, size, contentType, body: null, start, end };
    }
  }

  const stream = createReadStream(mediaPath(fileName), { start, end });
  return {
    status: partial ? (206 as const) : (200 as const),
    size,
    contentType,
    body: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
    start,
    end,
  };
}
