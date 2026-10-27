import { callbackSecretMatches } from "@/lib/shop/mpesa";
import { handleStkCallback, markShopStale } from "@/lib/shop/service";

const accepted = () => Response.json({ ResultCode: 0, ResultDesc: "Accepted" });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ secret: string }> },
) {
  const { secret } = await params;
  if (!callbackSecretMatches(secret)) return new Response("Not found", { status: 404 });

  const payload = await request.json().catch(() => null);
  if (!payload) return accepted();

  try {
    const result = await handleStkCallback(payload);
    if (!result.handled) console.warn("M-Pesa callback for an unknown payment request was ignored.");
    markShopStale();
  } catch (error) {
    console.error("M-Pesa callback could not be processed:", error);
    return Response.json({ ResultCode: 1, ResultDesc: "Temporary error" }, { status: 500 });
  }
  return accepted();
}
