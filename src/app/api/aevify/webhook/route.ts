import { NextResponse } from "next/server";
import { WebhookSignatureError } from "@aevify/node";
import { aevify } from "@/lib/aevify";
import { getStore } from "@/lib/db";
import { env } from "@/lib/env";
import { errorResponse } from "@/lib/http";
import { applyPayment } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * POST /api/aevify/webhook: Aevify tells the store about payments here.
 * This is the source of truth for fulfilment: an order is only "paid" once a signed
 * payment.paid event arrives (or, as a backup, Aevify's API confirms it).
 */
export async function POST(request: Request) {
  const rawBody = await request.text(); // verify the exact bytes Aevify signed
  let event;
  try {
    event = await aevify().webhooks.constructEvent(rawBody, request.headers.get("aevify-signature"), env.aevifyWebhookSecret());
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      return NextResponse.json({ error: `Invalid signature: ${error.message}` }, { status: 400 });
    }
    return errorResponse(error);
  }

  try {
    const store = getStore();
    if (event.type === "webhook.test") return NextResponse.json({ received: true, test: true });

    const payment = event.data.object;
    const order = payment.orderId ? await store.getOrder(payment.orderId) : null;
    if (!order) {
      // Not one of ours (e.g. a payment link made in the dashboard): acknowledge so Aevify stops retrying.
      return NextResponse.json({ received: true, ignored: "no matching order" });
    }
    // Retries and duplicates are harmless: applyPayment only moves forward, and we remember event IDs.
    const fresh = await store.markEventProcessed(event.id, event.type);
    const updated = await applyPayment(order, payment, "webhook");
    console.info(`[admit] ${event.type} for ${order.number}: ${updated.status}${fresh ? "" : " (duplicate event)"}`);
    return NextResponse.json({ received: true, order: updated.number, status: updated.status, duplicate: !fresh });
  } catch (error) {
    // A 5xx makes Aevify retry later.
    return errorResponse(error);
  }
}
