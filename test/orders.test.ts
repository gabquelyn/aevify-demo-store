import { beforeEach, describe, expect, it } from "vitest";
import { POST as createOrderRoute } from "@/app/api/orders/route";
import { GET as getOrderRoute } from "@/app/api/orders/[id]/route";
import { POST as webhookRoute } from "@/app/api/aevify/webhook/route";
import { resetMemoryStore } from "@/lib/db";
import { fakePayment, installFakeAevify, signWebhook, WEBHOOK_SECRET } from "./helpers";

process.env.STORE_TEST_MODE = "memory";
process.env.AEVIFY_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.STORE_URL = "https://admit.example";

let aevify: ReturnType<typeof installFakeAevify>;
beforeEach(() => {
  resetMemoryStore();
  aevify = installFakeAevify();
  process.env.ORDER_SYNC_AFTER_SECONDS = "20";
});

async function placeOrder(body: unknown) {
  const res = await createOrderRoute(new Request("https://admit.example/api/orders", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
}

async function getOrder(id: string) {
  const res = await getOrderRoute(new Request(`https://admit.example/api/orders/${id}`), { params: Promise.resolve({ id }) });
  return (await res.json()).order;
}

function sendWebhook(type: string, payment: unknown, opts: { id?: string; secret?: string } = {}) {
  const body = JSON.stringify({ id: opts.id ?? `evt_${Math.random().toString(36).slice(2)}`, object: "event", type, createdAt: new Date().toISOString(), livemode: false, data: { object: payment } });
  return webhookRoute(
    new Request("https://admit.example/api/aevify/webhook", { method: "POST", body, headers: { "aevify-signature": signWebhook(body, opts.secret) } }),
  );
}

describe("orders", () => {
  it("prices orders from the ticket list and creates one Aevify payment per order", async () => {
    const { status, body } = await placeOrder({ items: [{ ticketId: "eko-night-sessions.floor", quantity: 2 }, { ticketId: "midnight-classics.seat", quantity: 1 }, { ticketId: "eko-night-sessions.floor", quantity: 1 }] });
    expect(status).toBe(201);
    expect(body.order.total).toBe("21.50"); // 3 × 6.00 + 3.50, duplicate lines merged
    expect(body.order.items).toHaveLength(2);
    expect(body.order.status).toBe("pending");
    const create = aevify.requests.find((r) => r.method === "POST")!;
    expect(create.body).toMatchObject({
      amount: "21.50",
      orderId: body.order.id,
      successUrl: `https://admit.example/orders/${body.order.id}`,
      cancelUrl: "https://admit.example/events/eko-night-sessions",
    });
    expect(create.idempotencyKey).toBe(body.order.id);
  });

  it("rejects unknown tickets, empty orders and too many tickets", async () => {
    expect((await placeOrder({ items: [{ ticketId: "nope.nope", quantity: 1 }] })).status).toBe(400);
    expect((await placeOrder({ items: [{ ticketId: "lagos-tech-summit.vip", quantity: 11 }] })).status).toBe(400);
    expect((await placeOrder({ items: [] })).status).toBe(400);
  });

  it("agent orders must be locked to the agent's wallet", async () => {
    expect((await placeOrder({ items: [{ ticketId: "lagos-tech-summit.general", quantity: 1 }], buyer: "agent" })).status).toBe(400);
    const agent = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955";
    const { body } = await placeOrder({ items: [{ ticketId: "lagos-tech-summit.general", quantity: 1 }], buyer: "agent", payer: agent });
    expect(body.order.buyer).toBe("agent");
    expect(aevify.requests.find((r) => r.method === "POST")!.body).toMatchObject({ payer: agent });
  });
});

describe("webhook", () => {
  it("marks the order paid from a signed payment.paid event, once", async () => {
    const { body } = await placeOrder({ items: [{ ticketId: "lagos-tech-summit.general", quantity: 1 }] });
    const paid = aevify.update(body.order.paymentId, { status: "paid", paidBy: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", txHash: "0xabc", paidAt: new Date().toISOString() });

    const res = await sendWebhook("payment.paid", paid, { id: "evt_1" });
    expect(res.status).toBe(200);
    let order = await getOrder(body.order.id);
    expect(order.status).toBe("paid");
    expect(order.confirmedBy).toBe("webhook");
    expect(order.paidBy).toBe(paid.paidBy);

    // Aevify retries: same event again is harmless
    const again = await sendWebhook("payment.paid", paid, { id: "evt_1" });
    expect((await again.json()).duplicate).toBe(true);
    order = await getOrder(body.order.id);
    expect(order.timeline.filter((t: { text: string }) => t.text.startsWith("Paid")).length).toBe(1);
  });

  it("tracks refunds", async () => {
    const { body } = await placeOrder({ items: [{ ticketId: "lagos-tech-summit.general", quantity: 1 }] });
    const paid = aevify.update(body.order.paymentId, { status: "paid", paidBy: "0x1", txHash: "0xabc", paidAt: new Date().toISOString() });
    await sendWebhook("payment.paid", paid);
    await sendWebhook("payment.refunded", { ...paid, refunded: "4.00" });
    expect((await getOrder(body.order.id)).status).toBe("partially_refunded");
    await sendWebhook("payment.refunded", { ...paid, status: "refunded", refunded: "9.00" });
    const order = await getOrder(body.order.id);
    expect(order.status).toBe("refunded");
    expect(order.refunded).toBe("9.00");
  });

  it("rejects bad signatures and ignores unknown payments", async () => {
    const { body } = await placeOrder({ items: [{ ticketId: "lagos-tech-summit.general", quantity: 1 }] });
    const paid = aevify.update(body.order.paymentId, { status: "paid" });
    expect((await sendWebhook("payment.paid", paid, { secret: "whsec_someone_else" })).status).toBe(400);
    expect((await getOrder(body.order.id)).status).toBe("pending");

    const res = await sendWebhook("payment.paid", fakePayment({ status: "paid", orderId: "ord_unknown" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toBeTruthy();
  });

  it("acknowledges test events", async () => {
    const res = await sendWebhook("webhook.test", fakePayment());
    expect(res.status).toBe(200);
  });
});

describe("backup check for late webhooks", () => {
  it("asks Aevify directly once a pending order is a few seconds old", async () => {
    process.env.ORDER_SYNC_AFTER_SECONDS = "0";
    const { body } = await placeOrder({ items: [{ ticketId: "lagos-tech-summit.general", quantity: 1 }] });
    aevify.update(body.order.paymentId, { status: "paid", paidBy: "0x1", txHash: "0xabc", paidAt: new Date().toISOString() });
    const order = await getOrder(body.order.id);
    expect(order.status).toBe("paid");
    expect(order.confirmedBy).toBe("api");
  });
});
