import { getPublicOrder } from "@/lib/shop/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const order = await getPublicOrder(token);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  return Response.json(order, {
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
