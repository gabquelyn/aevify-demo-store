import type { Metadata } from "next";
import { eyebrow } from "@/components/ui";
import { AgentView } from "./agent-view";

export const metadata: Metadata = { title: "AI agent" };

export default function AgentPage() {
  return (
    <div>
      <p className={eyebrow}>AI agent customer</p>
      <h1 className="mt-4 max-w-3xl text-5xl font-medium leading-[1] tracking-tightest sm:text-6xl">An agent that books tickets for a team.</h1>
      <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">
        It has its own wallet and a spending policy. It reads Admit&apos;s ticket list, verifies every detail of Aevify&apos;s payment, pays on
        QDay Aevum by itself, and stops to ask a human when an order breaks its limits.
      </p>
      <AgentView />
    </div>
  );
}
