/**
 * The Admit team agent: an AI agent with its own wallet that books event passes for a team.
 *
 * It shops like any customer, but in code:
 *   1. read Admit's ticket list and decide what to buy
 *   2. check the order against its spending policy (or ask a human)
 *   3. place an order locked to its own wallet
 *   4. read Aevify's public checkout data and verify every detail before signing anything
 *   5. pay the Aevify contract on Aevum from its own wallet
 *   6. wait for the store to confirm (the store learns from Aevify's signed webhook)
 *
 * Used by the live agent page (/agent) and the command-line script (scripts/agent.ts).
 * No framework or browser APIs, so it runs anywhere with fetch.
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  getAddress,
  http,
  isAddressEqual,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fromUnits, sum, times, toUnits } from "../money";

export type AgentPolicy = {
  /** Most the agent may spend on one order without asking a human (tUSD8). */
  maxPerOrder: string;
  /** Most the agent may spend per UTC day (tUSD8). */
  dailyBudget: string;
};

export type Scenario = "one-pass" | "team-passes";

export const SCENARIOS: Record<Scenario, { title: string; items: Array<{ ticketId: string; quantity: number }> }> = {
  "one-pass": {
    title: "Book a Lagos Tech Summit pass for the new engineer",
    items: [{ ticketId: "lagos-tech-summit.general", quantity: 1 }],
  },
  "team-passes": {
    title: "Book Lagos Tech Summit passes for the 3-person platform team",
    items: [{ ticketId: "lagos-tech-summit.general", quantity: 3 }],
  },
};

export type StepKind = "think" | "check" | "warn" | "tx" | "done" | "error";
export type Step = { kind: StepKind; text: string; detail?: string; href?: string };

export type AgentResult =
  | { outcome: "paid"; orderId: string; orderNumber: string; txHash: string; total: string }
  | { outcome: "needs_approval"; reason: string; total: string }
  | { outcome: "refused"; reason: string }
  | { outcome: "failed"; reason: string };

export type AgentOptions = {
  storeUrl: string;
  privateKey: Hex;
  policy: AgentPolicy;
  scenario: Scenario;
  /** Totals the agent already paid today (from its own records). */
  spentToday: () => Promise<string[]>;
  /** The network the agent is willing to pay on (44005 = QDay Aevum Testnet). */
  expectedChainId: number;
  /** Optional RPC for the agent's transactions; defaults to the one Aevify publishes. */
  rpcUrl?: string;
  emit: (step: Step) => void;
  fetch?: typeof fetch;
  /** How long to wait for the store to confirm the payment. */
  confirmTimeoutMs?: number;
};

type CatalogItem = { id: string; name: string; price: string };

export type CheckoutData = {
  id: string;
  status: string;
  merchant: { name: string; verified: boolean; payoutAddress: string | null };
  amount: string;
  amountBaseUnits: string;
  orderId: string | null;
  payer: string | null;
  expiresAt: string;
  chain: { id: number; name: string; rpcUrl: string | null; explorerUrl: string | null };
  token: { address: string; symbol: string; decimals: number };
  contractCall: {
    address: string;
    functionName: string;
    abi: Abi;
    approve: { token: string; spender: string; amount: string };
    args: {
      request: { paymentId: Hex; merchantId: Hex; amount: string; expiresAt: string; payer: string };
      signature: Hex;
    };
  };
};

// ---------------------------------------------------------------------------------------------
// Pure decision logic (unit tested)

/** Can the agent spend `total` given what it already spent today? */
export function checkPolicy(total: string, spentToday: string[], policy: AgentPolicy): { ok: true } | { ok: false; reason: string } {
  if (toUnits(total) > toUnits(policy.maxPerOrder)) {
    return { ok: false, reason: `${total} tUSD8 is over my ${policy.maxPerOrder} tUSD8 per-order limit` };
  }
  const spent = spentToday.length ? sum(spentToday) : "0.00";
  if (toUnits(spent) + toUnits(total) > toUnits(policy.dailyBudget)) {
    return {
      ok: false,
      reason: `I've spent ${spent} of my ${policy.dailyBudget} tUSD8 daily budget; ${total} more would go over`,
    };
  }
  return { ok: true };
}

export type CheckResult = { label: string; ok: boolean; detail: string };

/** Everything the agent verifies in Aevify's checkout data before it signs anything. */
export function verifyCheckout(
  checkout: CheckoutData,
  expect: { orderId: string; total: string; payer: Address; chainId: number; now?: Date },
): CheckResult[] {
  const now = expect.now ?? new Date();
  const request = checkout.contractCall.args.request;
  const secondsLeft = Math.floor((Date.parse(checkout.expiresAt) - now.getTime()) / 1000);
  const same = (a: string | null | undefined, b: string) => {
    try {
      return !!a && isAddressEqual(getAddress(a), getAddress(b));
    } catch {
      return false;
    }
  };
  return [
    { label: "Payment is open", ok: checkout.status === "created", detail: `status: ${checkout.status}` },
    { label: "It's for my order", ok: checkout.orderId === expect.orderId, detail: `orderId ${checkout.orderId ?? "missing"}` },
    {
      label: "Amount matches the listed price",
      ok: checkout.amount === expect.total && checkout.amountBaseUnits === toUnits(expect.total).toString() && request.amount === checkout.amountBaseUnits,
      detail: `${checkout.amount} ${checkout.token.symbol}, expected ${expect.total}`,
    },
    {
      label: "Merchant is verified on Aevum",
      ok: checkout.merchant.verified,
      detail: `${checkout.merchant.name}${checkout.merchant.payoutAddress ? `, pays out to ${short(checkout.merchant.payoutAddress)}` : ""}`,
    },
    { label: "Right network", ok: checkout.chain.id === expect.chainId, detail: `${checkout.chain.name} (${checkout.chain.id})` },
    { label: "Paying in tUSD8", ok: checkout.token.symbol === "tUSD8" && checkout.token.decimals === 6, detail: short(checkout.token.address) },
    {
      label: "Only my wallet can pay it",
      ok: same(request.payer, expect.payer) && same(checkout.payer, expect.payer),
      detail: `payer ${short(request.payer)}`,
    },
    {
      label: "Approval goes to the checkout contract, for this amount only",
      ok:
        same(checkout.contractCall.approve.spender, checkout.contractCall.address) &&
        same(checkout.contractCall.approve.token, checkout.token.address) &&
        checkout.contractCall.approve.amount === checkout.amountBaseUnits,
      detail: `spender ${short(checkout.contractCall.address)}`,
    },
    { label: "Not about to expire", ok: secondsLeft > 60, detail: `${Math.max(0, Math.floor(secondsLeft / 60))} min left` },
  ];
}

export function short(address: string | null | undefined): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "none";
}

// ---------------------------------------------------------------------------------------------
// The run

export async function runAgent(options: AgentOptions): Promise<AgentResult> {
  const { emit, policy } = options;
  const doFetch = options.fetch ?? fetch;
  const account = privateKeyToAccount(options.privateKey);
  const storeUrl = options.storeUrl.replace(/\/+$/, "");
  const plan = SCENARIOS[options.scenario];

  const getJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await doFetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
    const body = (await res.json().catch(() => ({}))) as T & { error?: string | { message?: string } };
    if (!res.ok) {
      const message = typeof body.error === "string" ? body.error : body.error?.message;
      throw new Error(message ?? `${url} responded ${res.status}`);
    }
    return body;
  };

  try {
    emit({ kind: "think", text: `Task: ${plan.title}`, detail: `My wallet: ${account.address}` });

    // 1. Read the ticket list and price the order myself.
    const catalog = await getJson<{ data: CatalogItem[] }>(`${storeUrl}/api/tickets`);
    const lines = plan.items.map(({ ticketId, quantity }) => {
      const ticket = catalog.data.find((t) => t.id === ticketId);
      if (!ticket) throw new Error(`${ticketId} isn't on sale anymore.`);
      return { ...ticket, quantity };
    });
    const total = sum(lines.map((l) => times(l.price, l.quantity)));
    emit({
      kind: "think",
      text: `Read the ticket list: ${lines.map((l) => `${l.quantity} × ${l.name} at ${l.price}`).join(", ")} = ${total} tUSD8`,
    });

    // 2. Spending policy, before anything is created or signed.
    const spent = await options.spentToday();
    const policyCheck = checkPolicy(total, spent, policy);
    if (!policyCheck.ok) {
      emit({ kind: "warn", text: "Stopping: this needs a human's approval", detail: policyCheck.reason });
      return { outcome: "needs_approval", reason: policyCheck.reason, total };
    }
    emit({
      kind: "check",
      text: "Within my spending policy",
      detail: `≤ ${policy.maxPerOrder} per order; ${spent.length ? sum(spent) : "0.00"} of ${policy.dailyBudget} spent today`,
    });

    // 3. Place the order, locked to my wallet.
    const { order } = await getJson<{ order: { id: string; number: string; paymentId: string; checkoutUrl: string; total: string } }>(
      `${storeUrl}/api/orders`,
      {
        method: "POST",
        body: JSON.stringify({ items: plan.items, buyer: "agent", payer: account.address }),
      },
    );
    emit({ kind: "think", text: `Placed order ${order.number}, payable only by my wallet`, detail: `Aevify payment ${order.paymentId}` });

    // 4. Read Aevify's public checkout data and verify every detail.
    const aevifyOrigin = new URL(order.checkoutUrl).origin;
    const checkout = await getJson<CheckoutData>(`${aevifyOrigin}/api/v1/checkout/${order.paymentId}`);
    const checks = verifyCheckout(checkout, { orderId: order.id, total, payer: account.address, chainId: options.expectedChainId });
    for (const c of checks) emit({ kind: c.ok ? "check" : "error", text: c.label, detail: c.detail });
    const failed = checks.filter((c) => !c.ok);
    if (failed.length) {
      const reason = `Refusing to pay: ${failed.map((c) => c.label.toLowerCase()).join("; ")}`;
      emit({ kind: "error", text: reason });
      return { outcome: "refused", reason };
    }

    // 5. Pay on Aevum from my own wallet.
    const rpcUrl = options.rpcUrl ?? checkout.chain.rpcUrl;
    if (!rpcUrl) throw new Error("No RPC URL for the network. Set AGENT_RPC_URL.");
    const chain = defineChain({
      id: checkout.chain.id,
      name: checkout.chain.name,
      nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    });
    const reader = createPublicClient({ chain, transport: http(rpcUrl) });
    const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
    const txUrl = (hash: string) => (checkout.chain.explorerUrl ? `${checkout.chain.explorerUrl.replace(/\/+$/, "")}/tx/${hash}` : undefined);

    const amount = BigInt(checkout.amountBaseUnits);
    const token = getAddress(checkout.token.address);
    const spender = getAddress(checkout.contractCall.address);
    const [balance, gas] = await Promise.all([
      reader.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
      reader.getBalance({ address: account.address }),
    ]);
    if (balance < amount) throw new Error(`My wallet has ${fromUnits(balance)} tUSD8; I need ${checkout.amount}.`);
    if (gas === 0n) throw new Error("My wallet has no tQDAY for gas.");
    emit({ kind: "check", text: "Enough tUSD8 and gas in my wallet", detail: `${fromUnits(balance)} tUSD8` });

    const allowance = await reader.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [account.address, spender] });
    if (allowance < amount) {
      const approveHash = await wallet.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, amount] });
      emit({ kind: "tx", text: `Approved exactly ${checkout.amount} tUSD8 for the checkout contract`, detail: approveHash, href: txUrl(approveHash) });
      const receipt = await reader.waitForTransactionReceipt({ hash: approveHash });
      if (receipt.status !== "success") throw new Error("The approval transaction failed.");
    }

    const r = checkout.contractCall.args.request;
    const request = {
      paymentId: r.paymentId,
      merchantId: r.merchantId,
      amount: BigInt(r.amount),
      expiresAt: BigInt(r.expiresAt),
      payer: getAddress(r.payer),
    };
    // Simulate first: contract errors surface here, before any gas is spent.
    const { request: payCall } = await reader.simulateContract({
      account,
      address: spender,
      abi: checkout.contractCall.abi,
      functionName: "pay",
      args: [request, checkout.contractCall.args.signature],
    });
    const payHash = await wallet.writeContract(payCall);
    emit({ kind: "tx", text: `Paid ${checkout.amount} tUSD8 to ${checkout.merchant.name} on ${checkout.chain.name}`, detail: payHash, href: txUrl(payHash) });
    const payReceipt = await reader.waitForTransactionReceipt({ hash: payHash });
    if (payReceipt.status !== "success") throw new Error("The payment transaction failed.");

    // 6. Wait for the store to confirm (it hears from Aevify's signed webhook).
    emit({ kind: "think", text: "Waiting for the store to confirm…" });
    const deadline = Date.now() + (options.confirmTimeoutMs ?? 90_000);
    for (;;) {
      const { order: latest } = await getJson<{ order: { status: string; confirmedBy: string | null } }>(`${storeUrl}/api/orders/${order.id}`);
      if (latest.status === "paid") {
        emit({
          kind: "done",
          text: `${order.number} confirmed by Admit`,
          detail: latest.confirmedBy === "webhook" ? "The store got Aevify's signed payment.paid webhook." : "The store confirmed it with Aevify's API.",
        });
        return { outcome: "paid", orderId: order.id, orderNumber: order.number, txHash: payHash, total };
      }
      if (Date.now() > deadline) {
        emit({ kind: "warn", text: "Paid on-chain; the store hasn't confirmed yet", detail: "It will update as soon as Aevify's webhook arrives." });
        return { outcome: "paid", orderId: order.id, orderNumber: order.number, txHash: payHash, total };
      }
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  } catch (error) {
    const reason = friendly(error);
    emit({ kind: "error", text: reason });
    return { outcome: "failed", reason };
  }
}

function friendly(error: unknown): string {
  const e = error as { shortMessage?: string; message?: string };
  return (e?.shortMessage ?? e?.message ?? String(error)).split("\n")[0]!;
}
