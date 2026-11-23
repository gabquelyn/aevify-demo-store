import type { Payment } from "@aevify/node";
import { z } from "zod";
import { aevify } from "./aevify";
import { aevifyConfig, explorerTxUrl } from "./aevify-config";
import { getStore } from "./db";
import { env } from "./env";
import { fromUnits, sum, times, toUnits } from "./money";
import { getTicket } from "./events";
import type { Order, OrderStatus, PublicOrder, TimelineEntry } from "./types";

export const createOrderSchema = z.object({
  items: z
    .array(z.object({ ticketId: z.string().min(1).max(80), quantity: z.number().int().min(1).max(10) }))
    .min(1, "Choose at least one ticket.")
    .max(10),
  buyer: z.enum(["customer", "agent"]).default("customer"),
  /** Agents lock their order to their own wallet, so nobody else can pay it. */
  payer: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "payer must be a wallet address")
    .optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export class OrderError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

function entry(text: string): TimelineEntry {
  return { at: new Date().toISOString(), text };
}

/**
 * Create an order and its Aevify payment. The order ID is the payment's `orderId` and its
 * idempotency key, so a retried request can never create two payments for one order.
 */
export async function createOrder(input: CreateOrderInput, storeUrl: string): Promise<Order> {
  if (input.buyer === "agent" && !input.payer) throw new OrderError("Agent orders must set payer (the agent's wallet).");

  // Merge duplicate lines and price everything from the catalog, never from the request.
  const quantities = new Map<string, number>();
  for (const { ticketId, quantity } of input.items) quantities.set(ticketId, (quantities.get(ticketId) ?? 0) + quantity);
  const items = [...quantities].map(([ticketId, quantity]) => {
    const ticket = getTicket(ticketId);
    if (!ticket) throw new OrderError(`Unknown ticket: ${ticketId}`);
    if (quantity > 10) throw new OrderError(`At most 10 tickets for ${ticket.name} per order.`);
    return { ticketId, name: ticket.name, unitPrice: ticket.price, quantity };
  });
  const total = sum(items.map((i) => times(i.unitPrice, i.quantity)));
  if (toUnits(total) <= 0n) throw new OrderError("The total must be more than zero.");

  const now = new Date().toISOString();
  const id = `ord_${randomCode(16)}`;
  const order: Order = {
    _id: id,
    number: `AD-${randomCode(5)}`,
    items,
    total,
    status: "pending",
    buyer: input.buyer,
    payer: input.payer ?? null,
    paymentId: null,
    checkoutUrl: null,
    expiresAt: null,
    paidBy: null,
    txHash: null,
    refunded: "0.00",
    confirmedBy: null,
    timeline: [entry(input.buyer === "agent" ? "Order placed by an AI agent" : "Order placed")],
    createdAt: now,
    updatedAt: now,
    paidAt: null,
    lastSyncAt: null,
  };
  const store = getStore();
  await store.insertOrder(order);

  const summary = items.map((i) => `${i.quantity} × ${i.name}`).join(", ");
  try {
    const payment = await aevify().payments.create(
      {
        amount: total,
        orderId: id,
        description: `Admit ${order.number}: ${summary}`.slice(0, 500),
        payer: input.payer as `0x${string}` | undefined,
        expiresInSeconds: 15 * 60,
        successUrl: `${storeUrl}/orders/${id}`,
        cancelUrl: `${storeUrl}/events/${getTicket(items[0]!.ticketId)!.eventId}`,
        metadata: { store: "admit", orderNumber: order.number, buyer: input.buyer },
      },
      { idempotencyKey: id },
    );
    const updated = await store.updateOrder(
      id,
      { paymentId: payment.id, checkoutUrl: payment.checkoutUrl, expiresAt: payment.expiresAt },
      [entry(`Aevify payment created (${payment.id})`)],
    );
    return updated!;
  } catch (error) {
    await store.updateOrder(id, { status: "failed" }, [entry("Couldn't create the payment")]);
    throw error;
  }
}

/**
 * Bring an order up to date with its Aevify payment. Used by the webhook (the normal path)
 * and by the backup check when a webhook is late. Safe to call any number of times.
 */
export async function applyPayment(order: Order, payment: Payment, via: "webhook" | "api"): Promise<Order> {
  if (payment.orderId !== order._id || (order.paymentId && payment.id !== order.paymentId)) {
    throw new OrderError("Payment doesn't belong to this order.", 409);
  }
  const store = getStore();
  const timeline: TimelineEntry[] = [];
  const patch: Partial<Order> = { lastSyncAt: new Date().toISOString() };

  const isPaid = payment.status === "paid" || payment.status === "refunded";
  if (isPaid && !order.paidAt) {
    patch.paidAt = payment.paidAt ?? new Date().toISOString();
    patch.paidBy = payment.paidBy;
    patch.txHash = payment.txHash;
    patch.confirmedBy = via;
    timeline.push(entry(`Paid on Aevum (confirmed by ${via === "webhook" ? "webhook" : "an Aevify API check"})`));
  }

  let status: OrderStatus = order.status;
  if (isPaid) {
    const refunded = payment.refunded ?? "0.00";
    status = payment.status === "refunded" ? "refunded" : toUnits(refunded) > 0n ? "partially_refunded" : "paid";
    if (toUnits(refunded) > toUnits(order.refunded)) {
      patch.refunded = fromUnits(toUnits(refunded));
      timeline.push(entry(`Refunded ${fromUnits(toUnits(refunded) - toUnits(order.refunded))} tUSD8`));
    }
  } else if (payment.status === "expired" && order.status === "pending") {
    status = "expired";
    timeline.push(entry("Payment window closed without payment"));
  }
  if (status !== order.status) patch.status = status;

  return (await store.updateOrder(order._id, patch, timeline)) ?? order;
}

/** Backup for late webhooks: if a pending order is older than a few seconds, ask Aevify. */
export async function syncIfStale(order: Order): Promise<Order> {
  if (order.status !== "pending" || !order.paymentId) return order;
  const last = Date.parse(order.lastSyncAt ?? order.createdAt);
  if (Date.now() - last < env.orderSyncAfterMs()) return order;
  try {
    const payment = await aevify().payments.retrieve(order.paymentId);
    return await applyPayment(order, payment, "api");
  } catch {
    await getStore().updateOrder(order._id, { lastSyncAt: new Date().toISOString() });
    return order;
  }
}

export async function toPublicOrder(order: Order): Promise<PublicOrder> {
  const { _id, lastSyncAt: _sync, ...rest } = order;
  return { id: _id, ...rest, explorerTxUrl: explorerTxUrl(await aevifyConfig(), order.txHash) };
}

/** The URL customers come back to; set STORE_URL in production. */
export function resolveStoreUrl(request: Request): string {
  return env.storeUrl() ?? new URL(request.url).origin;
}
