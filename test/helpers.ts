import { createHmac } from "node:crypto";
import { Aevify, type Payment } from "@aevify/node";
import { setAevifyClient } from "@/lib/aevify";

export const WEBHOOK_SECRET = "whsec_test_admit_0123456789abcdef";

/** Sign a webhook body the way Aevify does: t=<unix>,v1=HMAC-SHA256("<t>.<body>"). */
export function signWebhook(body: string, secret = WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export function fakePayment(overrides: Partial<Payment> = {}): Payment {
  const now = new Date().toISOString();
  return {
    id: "pay_test123",
    object: "payment",
    status: "created",
    amount: "9.00",
    amountBaseUnits: "9000000",
    currency: "tUSD8",
    fee: "0.00",
    refunded: "0.00",
    orderId: null,
    description: null,
    metadata: {},
    payer: null,
    paidBy: null,
    txHash: null,
    checkoutUrl: "https://aevify.example/pay/pay_test123",
    onchain: { paymentId: "0x01", merchantId: "0x02" },
    successUrl: null,
    cancelUrl: null,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    paidAt: null,
    createdAt: now,
    livemode: false,
    ...overrides,
  } as Payment;
}

/**
 * A fake Aevify API behind the real @aevify/node client: records created payments and
 * lets tests change their status.
 */
export function installFakeAevify() {
  const payments = new Map<string, Payment>();
  const requests: Array<{ method: string; path: string; body: unknown; idempotencyKey: string | null }> = [];
  let counter = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const headers = new Headers(init?.headers);
    requests.push({ method: init?.method ?? "GET", path: url.pathname, body, idempotencyKey: headers.get("idempotency-key") });
    if (init?.method === "POST" && url.pathname === "/api/v1/payments") {
      const id = `pay_fake${++counter}`;
      const payment = fakePayment({
        id,
        amount: body.amount,
        orderId: body.orderId,
        payer: body.payer ?? null,
        checkoutUrl: `https://aevify.example/pay/${id}`,
        metadata: body.metadata ?? {},
      });
      payments.set(id, payment);
      return Response.json(payment, { status: 201 });
    }
    const match = url.pathname.match(/^\/api\/v1\/payments\/(pay_\w+)$/);
    if (match) {
      const payment = payments.get(match[1]!);
      return payment ? Response.json(payment) : Response.json({ error: { type: "not_found", message: "No such payment" } }, { status: 404 });
    }
    return Response.json({ error: { type: "not_found", message: "Not found" } }, { status: 404 });
  };
  setAevifyClient(new Aevify("sk_test_fake", { baseUrl: "https://aevify.example", fetch: fetchImpl, maxRetries: 0 }));
  return {
    payments,
    requests,
    update(id: string, patch: Partial<Payment>) {
      const next = { ...payments.get(id)!, ...patch } as Payment;
      payments.set(id, next);
      return next;
    },
  };
}
