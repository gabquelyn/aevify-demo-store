import { describe, expect, it } from "vitest";
import { checkPolicy, verifyCheckout, type CheckoutData } from "@/lib/agent/agent";

const policy = { maxPerOrder: "10.00", dailyBudget: "25.00" };
const AGENT = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955" as const;
const CONTRACT = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

describe("agent spending policy", () => {
  it("allows orders within both limits", () => {
    expect(checkPolicy("9.00", [], policy).ok).toBe(true);
    expect(checkPolicy("9.00", ["9.00"], policy).ok).toBe(true);
  });
  it("asks a human above the per-order limit", () => {
    const r = checkPolicy("27.00", [], policy);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/per-order limit/);
  });
  it("stops at the daily budget", () => {
    const r = checkPolicy("9.00", ["9.00", "9.00"], policy); // 27 > 25
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/daily budget/);
  });
});

function checkout(overrides: Partial<CheckoutData> = {}, request: Partial<CheckoutData["contractCall"]["args"]["request"]> = {}): CheckoutData {
  return {
    id: "pay_1",
    status: "created",
    merchant: { name: "Admit", verified: true, payoutAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
    amount: "9.00",
    amountBaseUnits: "9000000",
    orderId: "ord_1",
    payer: AGENT,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    chain: { id: 44005, name: "QDay Aevum Testnet", rpcUrl: "https://rpc-test.qday.info", explorerUrl: null },
    token: { address: TOKEN, symbol: "tUSD8", decimals: 6 },
    contractCall: {
      address: CONTRACT,
      functionName: "pay",
      abi: [],
      approve: { token: TOKEN, spender: CONTRACT, amount: "9000000" },
      args: {
        request: { paymentId: "0x01", merchantId: "0x02", amount: "9000000", expiresAt: "9999999999", payer: AGENT, ...request },
        signature: "0x03",
      },
    },
    ...overrides,
  };
}

const expected = { orderId: "ord_1", total: "9.00", payer: AGENT, chainId: 44005 };

describe("agent checkout verification", () => {
  it("passes a correct checkout", () => {
    expect(verifyCheckout(checkout(), expected).every((c) => c.ok)).toBe(true);
  });
  it.each([
    ["an overcharge", checkout({ amount: "19.00", amountBaseUnits: "19000000" }), "Amount matches the listed price"],
    ["an unverified merchant", checkout({ merchant: { name: "X", verified: false, payoutAddress: null } }), "Merchant is verified on Aevum"],
    ["the wrong network", checkout({ chain: { id: 1, name: "Ethereum", rpcUrl: null, explorerUrl: null } }), "Right network"],
    ["a payment anyone could pay", checkout({}, { payer: "0x0000000000000000000000000000000000000000" }), "Only my wallet can pay it"],
    ["a payment for another order", checkout({ orderId: "ord_2" }), "It's for my order"],
    ["an already-paid payment", checkout({ status: "paid" }), "Payment is open"],
    ["one about to expire", checkout({ expiresAt: new Date(Date.now() + 20_000).toISOString() }), "Not about to expire"],
  ])("refuses %s", (_name, data, label) => {
    const failed = verifyCheckout(data, expected).filter((c) => !c.ok).map((c) => c.label);
    expect(failed).toContain(label);
  });
  it("refuses an approval to some other contract", () => {
    const data = checkout();
    data.contractCall.approve.spender = "0x9999999999999999999999999999999999999999";
    expect(verifyCheckout(data, expected).find((c) => c.label.startsWith("Approval"))!.ok).toBe(false);
  });
});
