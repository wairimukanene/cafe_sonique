import { MAX_PHOTO_BYTES } from "@/lib/media/slots";

const MIN_LONG_EDGE = 800;
const attempts = [
  { longEdge: 2400, quality: 0.85 },
  { longEdge: 2000, quality: 0.8 },
  { longEdge: 1600, quality: 0.75 },
];

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function preparePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    if (longEdge < MIN_LONG_EDGE) {
      throw new Error("This photo is too small and will look blurry. Please choose a larger one.");
    }

    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.longEdge / longEdge);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      let blob = await canvasToBlob(canvas, "image/webp", attempt.quality);
      if (!blob || blob.type !== "image/webp") {
        blob = await canvasToBlob(canvas, "image/jpeg", attempt.quality);
      }
      if (blob && blob.size <= MAX_PHOTO_BYTES) return blob;
    }
  } finally {
    bitmap.close();
  }

  throw new Error("This photo could not be made small enough. Please try a different one.");
}

export function photoFile(blob: Blob, name: string) {
  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${name}.${extension}`, { type: blob.type });
}
