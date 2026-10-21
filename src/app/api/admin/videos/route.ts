import { getStaffSession } from "@/lib/auth/session";
import { toStaffRole } from "@/lib/auth/roles";
import { MAX_VIDEO_BYTES } from "@/lib/media/slots";
import { SitePhotoError, storeSiteVideo } from "@/lib/media/storage";

const UPLOAD_HEADER = "x-sonique-upload";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (request.headers.get(UPLOAD_HEADER) !== "1" || !sameOrigin(request)) {
    return Response.json({ message: "Upload rejected." }, { status: 403 });
  }

  const session = await getStaffSession();
  if (!session || !toStaffRole(session.user.role)) {
    return Response.json({ message: "Please sign in again." }, { status: 401 });
  }

  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_VIDEO_BYTES) {
    return Response.json({ message: "That video is too large. Please keep it under 250 MB." }, { status: 413 });
  }
  if (!request.body) {
    return Response.json({ message: "No video was sent." }, { status: 400 });
  }

  try {
    const path = await storeSiteVideo(request.body);
    return Response.json({ path });
  } catch (error) {
    if (error instanceof SitePhotoError) {
      return Response.json({ message: error.message }, { status: 400 });
    }
    throw error;
  }
}
