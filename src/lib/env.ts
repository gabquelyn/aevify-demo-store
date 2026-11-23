/** Server-side configuration, read at request time (so changing it never needs a rebuild). */

function optional(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

function required(name: string): string {
  const v = optional(name);
  if (!v) throw new ConfigError(`${name} is not set. See .env.example.`);
  return v;
}

export class ConfigError extends Error {}

export const env = {
  isProduction: () => process.env.NODE_ENV === "production",
  /** In-memory orders for tests and quick local runs. Never in production. */
  memoryMode: () => process.env.STORE_TEST_MODE === "memory" && process.env.NODE_ENV !== "production",

  mongoUri: () => required("MONGODB_URI"),
  mongoDb: () => optional("MONGODB_DB") ?? "admit_tickets",

  /** Aevify's app URL, e.g. https://aevify.vercel.app. */
  aevifyUrl: () => (optional("AEVIFY_BASE_URL") ?? "https://aevify.vercel.app").replace(/\/+$/, "").replace(/\/api\/v1$/, ""),
  aevifySecretKey: () => required("AEVIFY_SECRET_KEY"),
  aevifyPublishableKey: () => optional("AEVIFY_PUBLISHABLE_KEY") ?? null,
  aevifyWebhookSecret: () => required("AEVIFY_WEBHOOK_SECRET"),

  /** This store's public URL (for success/cancel links). Falls back to the request's origin. */
  storeUrl: () => {
    const configured = optional("STORE_URL");
    if (configured) return configured.replace(/\/+$/, "");
    const vercel = optional("VERCEL_PROJECT_PRODUCTION_URL");
    return vercel ? `https://${vercel}` : undefined;
  },

  /** After this long, a pending order asks Aevify directly in case the webhook is late. */
  orderSyncAfterMs: () => Number(optional("ORDER_SYNC_AFTER_SECONDS") ?? 20) * 1000,

  agent: {
    privateKey: () => {
      const raw = optional("AGENT_PRIVATE_KEY");
      if (!raw) return undefined;
      const key = raw.startsWith("0x") ? raw : `0x${raw}`;
      if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new ConfigError("AGENT_PRIVATE_KEY must be 64 hex characters, with or without 0x.");
      return key as `0x${string}`;
    },
    maxPerOrder: () => optional("AGENT_MAX_PER_ORDER") ?? "10.00",
    dailyBudget: () => optional("AGENT_DAILY_BUDGET") ?? "25.00",
    expectedChainId: () => Number(optional("AGENT_EXPECTED_CHAIN_ID") ?? 44005),
    /** Optional: an RPC for the agent's transactions instead of the one Aevify publishes. */
    rpcUrl: () => optional("AGENT_RPC_URL"),
  },
};
