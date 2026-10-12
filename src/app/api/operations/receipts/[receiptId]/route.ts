import { readReceiptSecure } from "@/lib/operations/receipts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  const { receiptId } = await params;
  const receipt = await readReceiptSecure(receiptId);
  if (!receipt) return new Response("Not found", { status: 404 });

  const safeName = receipt.record.originalName.replace(/["\r\n]/g, "_");
  return new Response(receipt.bytes, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Content-Length": String(receipt.record.sizeBytes),
      "Content-Type": receipt.record.mimeType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
