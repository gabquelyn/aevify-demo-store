"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentIcon, shortAddress } from "@/components/status";
import { buttonPrimary, buttonSecondary, eyebrow, Spinner } from "@/components/ui";
import type { AgentResult, Step } from "@/lib/agent/agent";
import { toUnits } from "@/lib/money";

type Status =
  | { configured: false; policy: { maxPerOrder: string; dailyBudget: string } }
  | {
      configured: true;
      address: string;
      policy: { maxPerOrder: string; dailyBudget: string };
      spentToday: string;
      balances: { tusd8: string; gas: string } | null;
      chain: { name: string; explorerUrl: string | null } | null;
    };

const STEP_LABEL: Record<Step["kind"], string> = {
  think: "Plan",
  check: "Check",
  warn: "Stop",
  tx: "Chain",
  done: "Done",
  error: "Error",
};

export function AgentView() {
  const [status, setStatus] = useState<Status | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLLIElement | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/agent", { cache: "no-store" });
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [steps.length]);

  async function run(scenario: "one-pass" | "team-passes") {
    setRunning(scenario);
    setSteps([]);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "The agent couldn't start.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line) as { type: "step"; step: Step } | { type: "result"; result: AgentResult };
          if (msg.type === "step") setSteps((s) => [...s, msg.step]);
          else setResult(msg.result);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
      void loadStatus();
    }
  }

  const policy = status?.policy;
  const spent = status?.configured ? status.spentToday : "0.00";
  const pct = policy ? Math.min(100, Number((toUnits(spent) * 100n) / (toUnits(policy.dailyBudget) || 1n))) : 0;

  return (
    <div className="mt-12 grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-14">
      {/* The agent */}
      <aside className="h-fit space-y-8 lg:sticky lg:top-24">
        <div className="rounded-2xl bg-ink p-6 text-paper">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-white/15">
              <AgentIcon className="size-5" />
            </span>
            <div>
              <p className="font-medium">Team booking agent</p>
              <p className="font-mono text-[11px] text-faint" data-testid="agent-address">
                {status?.configured ? shortAddress(status.address) : status ? "No wallet configured" : "…"}
              </p>
            </div>
          </div>
          {status?.configured && (
            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10 text-sm">
              <div className="bg-ink p-3">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-faint">tUSD8</dt>
                <dd className="mt-1 font-medium tabular-nums" data-testid="agent-balance">
                  {status.balances?.tusd8 ?? "–"}
                </dd>
              </div>
              <div className="bg-ink p-3">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-faint">tQDAY gas</dt>
                <dd className="mt-1 font-medium tabular-nums">{status.balances?.gas ?? "–"}</dd>
              </div>
            </dl>
          )}
        </div>

        <div>
          <h2 className={eyebrow}>Spending policy</h2>
          <dl className="mt-4 space-y-4 text-[15px]">
            <div className="flex justify-between border-b border-line pb-4">
              <dt className="text-muted">Per order</dt>
              <dd>≤ {policy?.maxPerOrder ?? "…"} tUSD8</dd>
            </div>
            <div className="border-b border-line pb-4">
              <div className="flex justify-between">
                <dt className="text-muted">Today</dt>
                <dd data-testid="agent-spent">
                  {spent} of {policy?.dailyBudget ?? "…"}
                </dd>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-ink transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </dl>
          <ul className="mt-5 space-y-2 text-[13px] text-muted">
            <li>— Orders locked to its own wallet</li>
            <li>— Pays only merchants verified on Aevum</li>
            <li>— Checks the amount against the listed price</li>
            <li>— Approves the exact amount, never unlimited</li>
            <li className="text-ink">— Asks a human above its limits</li>
          </ul>
        </div>
      </aside>

      {/* Runs */}
      <section>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className={`${buttonPrimary} py-3`} disabled={!!running || !status?.configured} onClick={() => run("one-pass")}>
            {running === "one-pass" && <Spinner />} Book 1 pass · 9.00
          </button>
          <button type="button" className={`${buttonSecondary} py-3`} disabled={!!running || !status?.configured} onClick={() => run("team-passes")}>
            {running === "team-passes" && <Spinner />} Book 3 passes · 27.00
          </button>
        </div>

        {status && !status.configured && (
          <p className="mt-6 rounded-xl border border-line p-4 text-sm text-muted">
            The demo agent has no wallet yet. Set <code className="font-mono text-ink">AGENT_PRIVATE_KEY</code> on the server, or run it from a
            terminal with <code className="font-mono text-ink">npm run agent</code>.
          </p>
        )}
        {error && <p className="mt-6 rounded-xl border border-ink p-4 text-sm">{error}</p>}

        {steps.length === 0 && !running && !error && (
          <div className="mt-8 rounded-2xl border border-dashed border-line px-6 py-16 text-center text-[15px] text-muted">
            Run the agent to watch it read the ticket list, verify Aevify&apos;s payment details and pay on Aevum, step by step.
          </div>
        )}

        {steps.length > 0 && (
          <ol className="mt-8 border-t border-ink" data-testid="agent-steps">
            {steps.map((step, i) => (
              <li
                key={i}
                ref={i === steps.length - 1 ? endRef : undefined}
                className={`grid grid-cols-[56px_1fr] gap-4 border-b border-line py-3.5 ${step.kind === "warn" || step.kind === "error" ? "bg-surface" : ""}`}
              >
                <span
                  className={`pt-0.5 font-mono text-[10px] uppercase tracking-wider ${step.kind === "think" ? "text-faint" : step.kind === "check" ? "text-muted" : "text-ink"}`}
                >
                  {STEP_LABEL[step.kind]}
                </span>
                <div className="min-w-0">
                  <p className={`text-[15px] ${step.kind === "warn" || step.kind === "error" || step.kind === "done" ? "font-medium" : ""}`}>{step.text}</p>
                  {step.detail && (
                    <p className="mt-0.5 break-all font-mono text-[11px] text-muted">
                      {step.href ? (
                        <a href={step.href} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-4">
                          {step.detail} ↗
                        </a>
                      ) : (
                        step.detail
                      )}
                    </p>
                  )}
                </div>
              </li>
            ))}
            {running && (
              <li className="flex items-center gap-3 py-4 text-sm text-muted">
                <Spinner className="size-3" /> working…
              </li>
            )}
          </ol>
        )}

        {result && (
          <div data-testid="agent-result" className={`mt-8 rounded-2xl p-6 ${result.outcome === "paid" ? "bg-ink text-paper" : "border border-ink"}`}>
            {result.outcome === "paid" && (
              <p className="text-[15px]">
                <span className="font-medium">
                  Order {result.orderNumber} paid: {result.total} tUSD8.
                </span>{" "}
                <Link href={`/orders/${result.orderId}`} className="underline underline-offset-4">
                  View tickets
                </Link>
              </p>
            )}
            {result.outcome === "needs_approval" && (
              <p className="text-[15px]">
                <span className="font-medium">Needs human approval.</span> {result.reason}. Nothing was ordered or paid.
              </p>
            )}
            {(result.outcome === "refused" || result.outcome === "failed") && <p className="text-[15px]">{result.reason}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
