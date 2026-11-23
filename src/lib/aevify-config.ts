import { env } from "./env";

export type AevifyPublicConfig = {
  chain: { id: number; name: string; rpcUrl: string | null; explorerUrl: string | null; faucetUrl?: string | null };
  checkoutAddress: string;
  token: { address: string; symbol: string; decimals: number };
};

let cached: { at: number; value: AevifyPublicConfig } | null = null;

/** Aevify's public chain/token config (GET /api/v1/config), cached for 5 minutes. */
export async function aevifyConfig(): Promise<AevifyPublicConfig | null> {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.value;
  try {
    const res = await fetch(`${env.aevifyUrl()}/api/v1/config`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return cached?.value ?? null;
    cached = { at: Date.now(), value: (await res.json()) as AevifyPublicConfig };
    return cached.value;
  } catch {
    return cached?.value ?? null;
  }
}

export function explorerTxUrl(config: AevifyPublicConfig | null, txHash: string | null): string | null {
  return config?.chain.explorerUrl && txHash ? `${config.chain.explorerUrl.replace(/\/+$/, "")}/tx/${txHash}` : null;
}
