import { createPublicClient, erc20Abi, getAddress, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { aevifyConfig } from "../aevify-config";
import { getStore } from "../db";
import { env } from "../env";
import { fromUnits, sum } from "../money";
import type { AgentPolicy } from "./agent";

/** Server-side details of the Admit's demo agent (its key never leaves the server). */
export function agentAccount(): { address: Address; privateKey: `0x${string}` } | null {
  const privateKey = env.agent.privateKey();
  if (!privateKey) return null;
  return { address: privateKeyToAccount(privateKey).address, privateKey };
}

export function agentPolicy(): AgentPolicy {
  return { maxPerOrder: env.agent.maxPerOrder(), dailyBudget: env.agent.dailyBudget() };
}

export function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** The agent's own spending record: orders it paid today, from the store's database. */
export async function agentSpentToday(address: string): Promise<string[]> {
  return getStore().paidTotalSince(address, startOfUtcDay());
}

export async function agentStatus() {
  const account = agentAccount();
  const policy = agentPolicy();
  if (!account) return { configured: false as const, policy };
  const spent = await agentSpentToday(account.address);
  let balances: { tusd8: string; gas: string } | null = null;
  const config = await aevifyConfig();
  const rpcUrl = env.agent.rpcUrl() ?? config?.chain.rpcUrl;
  if (config && rpcUrl) {
    try {
      const client = createPublicClient({ transport: http(rpcUrl, { timeout: 8000 }) });
      const [token, gas] = await Promise.all([
        client.readContract({ address: getAddress(config.token.address), abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
        client.getBalance({ address: account.address }),
      ]);
      balances = { tusd8: fromUnits(token), gas: (Number(gas) / 1e18).toFixed(4) };
    } catch {
      balances = null;
    }
  }
  return {
    configured: true as const,
    address: account.address,
    policy,
    spentToday: spent.length ? sum(spent) : "0.00",
    balances,
    chain: config?.chain ?? null,
  };
}
