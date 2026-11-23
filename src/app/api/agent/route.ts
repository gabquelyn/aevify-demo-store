import { NextResponse } from "next/server";
import { agentStatus } from "@/lib/agent/server";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/agent: the demo agent's wallet, policy, today's spending and balances. */
export async function GET() {
  try {
    return NextResponse.json(await agentStatus());
  } catch (error) {
    return errorResponse(error);
  }
}
