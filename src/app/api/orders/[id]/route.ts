import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { syncIfStale, toPublicOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** GET /api/orders/:id: one order. Pending orders double-check with Aevify if the webhook is late. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await getStore().getOrder(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ order: await toPublicOrder(await syncIfStale(order)) });
  } catch (error) {
    return errorResponse(error);
  }
}
