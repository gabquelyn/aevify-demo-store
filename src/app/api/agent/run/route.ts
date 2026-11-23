import { NextResponse } from "next/server";
import { runAgent, SCENARIOS, type Scenario, type Step } from "@/lib/agent/agent";
import { agentAccount, agentPolicy, agentSpentToday } from "@/lib/agent/server";
import { getStore } from "@/lib/db";
import { env } from "@/lib/env";
import { errorResponse } from "@/lib/http";


export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LOCK = "agent-run";

/**
 * POST /api/agent/run { scenario }: run the team agent and stream its steps as NDJSON.
 * One run at a time; the daily budget caps what any number of clicks can spend.
 */
export async function POST(request: Request) {
  try {
    const { scenario } = (await request.json().catch(() => ({}))) as { scenario?: string };
    if (!scenario || !(scenario in SCENARIOS)) {
      return NextResponse.json({ error: `scenario must be one of: ${Object.keys(SCENARIOS).join(", ")}` }, { status: 400 });
    }
    const account = agentAccount();
    if (!account) return NextResponse.json({ error: "The demo agent isn't set up (AGENT_PRIVATE_KEY)." }, { status: 503 });

    const store = getStore();
    if (!(await store.acquireLock(LOCK, 110_000))) {
      return NextResponse.json({ error: "The agent is busy with another order. Try again in a minute." }, { status: 409 });
    }

    const storeUrl = env.storeUrl() ?? new URL(request.url).origin;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (data: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
        try {
          const result = await runAgent({
            storeUrl,
            privateKey: account.privateKey,
            policy: agentPolicy(),
            scenario: scenario as Scenario,
            spentToday: () => agentSpentToday(account.address),
            expectedChainId: env.agent.expectedChainId(),
            rpcUrl: env.agent.rpcUrl(),
            emit: (step: Step) => send({ type: "step", step }),
          });
          send({ type: "result", result });
        } catch (error) {
          send({ type: "result", result: { outcome: "failed", reason: (error as Error).message } });
        } finally {
          await store.releaseLock(LOCK).catch(() => undefined);
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
