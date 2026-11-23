import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { createOrder, createOrderSchema, resolveStoreUrl, toPublicOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** POST /api/orders { items: [{ ticketId, quantity }], buyer?, payer? }: create an order + Aevify payment. */
export async function POST(request: Request) {
  try {
    const input = createOrderSchema.parse(await request.json().catch(() => ({})));
    const order = await createOrder(input, resolveStoreUrl(request));
    return NextResponse.json({ order: await toPublicOrder(order) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** GET /api/orders: the most recent orders, for the live feed. */
export async function GET(request: Request) {
  try {
    const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 20) || 20, 50);
    const orders = await getStore().recentOrders(limit);
    return NextResponse.json({ data: await Promise.all(orders.map(toPublicOrder)) });
  } catch (error) {
    return errorResponse(error);
  }
}
