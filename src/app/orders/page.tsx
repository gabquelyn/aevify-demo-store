import type { Metadata } from "next";
import { eyebrow } from "@/components/ui";
import { OrdersFeed } from "./orders-feed";

export const metadata: Metadata = { title: "Live sales" };

export default function OrdersPage() {
  return (
    <div>
      <p className={`${eyebrow} inline-flex items-center gap-2`}>
        <span className="pulse-dot size-1.5 rounded-full bg-ink" /> Live
      </p>
      <h1 className="mt-4 text-5xl font-medium tracking-tightest sm:text-6xl">Sales</h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
        Every order on Admit, from people and from AI agents. Tickets are issued when Aevify&apos;s signed webhook confirms the payment.
      </p>
      <OrdersFeed />
    </div>
  );
}
