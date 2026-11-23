"use client";

import { AevifyButton } from "@aevify/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { buttonPrimary, eyebrow } from "@/components/ui";
import type { Event } from "@/lib/events";
import { times } from "@/lib/money";

export function BuyPanel({ event, aevifyUrl, publishableKey }: { event: Event; aevifyUrl: string; publishableKey: string | null }) {
  const router = useRouter();
  const [tierId, setTierId] = useState(event.tiers[0]!.id);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const orderRef = useRef<string | null>(null);
  const tier = event.tiers.find((t) => t.id === tierId)!;
  const total = times(tier.price, quantity);

  async function createPayment(): Promise<string> {
    setMessage(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ ticketId: `${event.id}.${tierId}`, quantity }] }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Couldn't start checkout.");
    orderRef.current = body.order.id;
    return body.order.paymentId as string;
  }

  return (
    <section className="mt-12" aria-labelledby="tickets-heading">
      <h2 id="tickets-heading" className={eyebrow}>
        Tickets
      </h2>
      <div className="mt-4 divide-y divide-line rounded-xl border border-line" role="radiogroup" aria-label="Ticket type">
        {event.tiers.map((t) => {
          const selected = t.id === tierId;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTierId(t.id)}
              className={`flex w-full items-start gap-4 px-5 py-4 text-left transition first:rounded-t-xl last:rounded-b-xl ${selected ? "bg-surface" : "hover:bg-surface/60"}`}
            >
              <span className={`mt-1 grid size-4 shrink-0 place-items-center rounded-full border ${selected ? "border-ink" : "border-faint"}`}>
                {selected && <span className="size-2 rounded-full bg-ink" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t.name}</span>
                <span className="mt-0.5 block text-[13px] text-muted">{t.perks.join(" · ")}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {t.price} <span className="text-[12px] font-normal text-muted">tUSD8</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <span className="text-[15px]">Quantity</span>
        <div className="inline-flex items-center rounded-full border border-line">
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full text-lg disabled:opacity-30"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="One fewer ticket"
          >
            −
          </button>
          <span className="w-8 text-center font-mono text-sm tabular-nums" data-testid="quantity">
            {quantity}
          </span>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full text-lg disabled:opacity-30"
            onClick={() => setQuantity((q) => Math.min(10, q + 1))}
            disabled={quantity >= 10}
            aria-label="One more ticket"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-baseline justify-between border-t border-ink pt-5">
        <span className="text-[15px]">Total</span>
        <span className="text-3xl font-medium tracking-[-0.03em] tabular-nums" data-testid="total">
          {total} <span className="text-base font-normal text-muted">tUSD8</span>
        </span>
      </div>

      {publishableKey ? (
        <AevifyButton
          publishableKey={publishableKey}
          baseUrl={aevifyUrl}
          createPayment={createPayment}
          className={`${buttonPrimary} mt-6 w-full py-3.5 text-[15px]`}
          onSuccess={() => {
            if (orderRef.current) router.push(`/orders/${orderRef.current}`);
          }}
          onCancel={() => setMessage("Payment cancelled. Nothing was charged.")}
          onError={(e) => setMessage(e.message)}
        >
          Pay {total} tUSD8
        </AevifyButton>
      ) : (
        <p className="mt-6 rounded-xl border border-line p-4 text-sm text-muted">Checkout isn&apos;t set up yet: add AEVIFY_PUBLISHABLE_KEY.</p>
      )}
      {message && (
        <p role="status" className="mt-3 text-center text-sm text-muted">
          {message}
        </p>
      )}
      <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
        Secure checkout by{" "}
        <a href={aevifyUrl} target="_blank" rel="noreferrer" className="text-ink">
          Aevify
        </a>{" "}
        · settles on QDay Aevum
      </p>
    </section>
  );
}
