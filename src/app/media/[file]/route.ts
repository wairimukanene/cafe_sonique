import { openSiteMedia } from "@/lib/media/storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const media = await openSiteMedia(file, request.headers.get("range"));
  if (!media) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": media.contentType,
    "X-Content-Type-Options": "nosniff",
  });

  if (media.status === 416) {
    headers.set("Content-Range", `bytes */${media.size}`);
    return new Response(null, { status: 416, headers });
  }

  headers.set("Content-Length", String(media.end - media.start + 1));
  if (media.status === 206) {
    headers.set("Content-Range", `bytes ${media.start}-${media.end}/${media.size}`);
  }
  return new Response(media.body, { status: media.status, headers });
}
