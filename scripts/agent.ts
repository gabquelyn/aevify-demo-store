/**
 * Run the Admit team agent from your terminal, against any Admit deployment.
 *
 *   npm run agent                   # one conference pass (within policy)
 *   npm run agent -- team-passes    # three passes: over the per-order limit, asks a human
 *
 * Env (from .env or the shell): AGENT_PRIVATE_KEY, STORE_URL (default http://localhost:3001),
 * AGENT_MAX_PER_ORDER (10.00), AGENT_DAILY_BUDGET (25.00), AGENT_EXPECTED_CHAIN_ID (44005),
 * AGENT_RPC_URL (optional). The agent keeps its own spending record in .agent-spend.json.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { runAgent, SCENARIOS, type Scenario, type Step } from "../src/lib/agent/agent.ts";

try {
  process.loadEnvFile(".env");
} catch {
  /* no .env file: use the shell's environment */
}

const SPEND_FILE = ".agent-spend.json";
const today = new Date().toISOString().slice(0, 10);

function spentToday(): string[] {
  if (!existsSync(SPEND_FILE)) return [];
  const record = JSON.parse(readFileSync(SPEND_FILE, "utf8")) as { date: string; totals: string[] };
  return record.date === today ? record.totals : [];
}

function recordSpend(total: string) {
  writeFileSync(SPEND_FILE, JSON.stringify({ date: today, totals: [...spentToday(), total] }, null, 2));
}

const ICON: Record<Step["kind"], string> = { think: "💭", check: "✅", warn: "✋", tx: "⛓️ ", done: "🎉", error: "❌" };

const scenario = (process.argv[2] ?? "one-pass") as Scenario;
if (!(scenario in SCENARIOS)) {
  console.error(`Unknown scenario "${scenario}". Use one of: ${Object.keys(SCENARIOS).join(", ")}`);
  process.exit(1);
}
const rawKey = process.env.AGENT_PRIVATE_KEY?.trim();
if (!rawKey) {
  console.error("Set AGENT_PRIVATE_KEY (the agent's testnet wallet).");
  process.exit(1);
}
const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;

const result = await runAgent({
  storeUrl: process.env.STORE_URL ?? "http://localhost:3001",
  privateKey,
  policy: { maxPerOrder: process.env.AGENT_MAX_PER_ORDER ?? "10.00", dailyBudget: process.env.AGENT_DAILY_BUDGET ?? "25.00" },
  scenario,
  spentToday: async () => spentToday(),
  expectedChainId: Number(process.env.AGENT_EXPECTED_CHAIN_ID ?? 44005),
  rpcUrl: process.env.AGENT_RPC_URL,
  emit: (step) => {
    console.log(`${ICON[step.kind]} ${step.text}`);
    if (step.detail) console.log(`   ${step.detail}`);
    if (step.href) console.log(`   ${step.href}`);
  },
});

if (result.outcome === "paid") recordSpend(result.total);
console.log(`\nOutcome: ${result.outcome}`);
process.exit(result.outcome === "paid" || result.outcome === "needs_approval" ? 0 : 1);
