import { NextResponse } from "next/server";
import { aevifyConfig } from "@/lib/aevify-config";
import { getStore } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** GET /api/health: is the store wired up? (No secrets in the output.) */
export async function GET() {
  const set = (fn: () => unknown) => {
    try {
      return Boolean(fn());
    } catch {
      return false;
    }
  };
  let database: "ok" | "error" = "ok";
  try {
    await getStore().recentOrders(1);
  } catch {
    database = "error";
  }
  const config = await aevifyConfig();
  const checks = {
    database,
    aevify: config ? "ok" : "unreachable",
    aevifyUrl: env.aevifyUrl(),
    chain: config ? { id: config.chain.id, name: config.chain.name } : null,
    secretKey: set(env.aevifySecretKey),
    publishableKey: set(env.aevifyPublishableKey),
    webhookSecret: set(env.aevifyWebhookSecret),
    agentWallet: set(env.agent.privateKey),
    storage: env.memoryMode() ? "memory (test mode)" : "mongodb",
  };
  const ok = database === "ok" && config && checks.secretKey && checks.publishableKey && checks.webhookSecret;
  return NextResponse.json({ service: "admit", status: ok ? "ok" : "degraded", ...checks }, { status: ok ? 200 : 503 });
}
