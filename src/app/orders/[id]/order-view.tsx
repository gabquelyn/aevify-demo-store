"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Barcode } from "@/components/barcode";
import { BuyerBadge, shortAddress, StatusBadge } from "@/components/status";
import { buttonPrimary, buttonSecondary, eyebrow, Spinner } from "@/components/ui";
import { formatDate, formatTime, getTicket } from "@/lib/events";
import { times } from "@/lib/money";
import type { PublicOrder } from "@/lib/types";

export function OrderView({ id }: { id: string }) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Couldn't load the order.");
        if (stop) return;
        setOrder(body.order);
        setError(null);
        // Keep checking while it waits for payment; then slowly, for refunds.
        timer = setTimeout(load, body.order.status === "pending" ? 2000 : 15000);
      } catch (e) {
        if (stop) return;
        setError((e as Error).message);
        timer = setTimeout(load, 5000);
      }
    }
    void load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (!order) {
    return <div className="grid place-items-center py-32 text-muted">{error ? <p>{error}</p> : <Spinner className="size-5" />}</div>;
  }

  const issued = order.status === "paid" || order.status === "partially_refunded";
  const open = order.status === "pending" && order.expiresAt && Date.parse(order.expiresAt) > Date.now();
  // One stub per ticket.
  const stubs = order.items.flatMap((item) => Array.from({ length: item.quantity }, (_, i) => ({ item, index: i + 1 })));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={order.status} />
        <BuyerBadge buyer={order.buyer} />
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">{order.number}</span>
      </div>

      <h1 className="mt-6 text-5xl font-medium leading-[1] tracking-tightest sm:text-6xl" data-testid="order-headline">
        {issued ? (
          "You're in."
        ) : order.status === "pending" ? (
          <span className="inline-flex items-center gap-4">
            Waiting for payment <Spinner className="size-6" />
          </span>
        ) : order.status === "refunded" ? (
          "Refunded."
        ) : order.status === "expired" ? (
          "This order expired."
        ) : (
          "Something went wrong."
        )}
      </h1>
      <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
        {issued
          ? `${stubs.length} ticket${stubs.length === 1 ? "" : "s"} issued. ${order.confirmedBy === "webhook" ? "Aevify confirmed the payment with a signed webhook." : "Payment confirmed with Aevify."}`
          : order.status === "pending"
            ? "Your tickets are issued the moment the payment settles on Aevum. This page updates by itself."
            : order.status === "refunded"
              ? `${order.refunded} tUSD8 went back to the wallet that paid. These tickets are no longer valid.`
              : "No payment was taken."}
      </p>
      {open && order.checkoutUrl && order.buyer === "customer" && (
        <a href={order.checkoutUrl} className={`${buttonPrimary} mt-6`}>
          Complete payment
        </a>
      )}

      {/* Tickets */}
      <ul className="mt-12 space-y-4" data-testid="tickets">
        {stubs.map(({ item, index }) => {
          const ticket = getTicket(item.ticketId);
          const code = `${order.number}-${item.ticketId.split(".")[1]!.slice(0, 3).toUpperCase()}${index}`;
          return (
            <li
              key={code}
              className={`grid grid-cols-[1fr_auto] overflow-hidden rounded-2xl border transition ${issued ? "border-ink" : "border-line text-faint"}`}
            >
              <div className="min-w-0 p-5 sm:p-7">
                <p className={eyebrow}>{issued ? "Admit one" : "Issued once paid"}</p>
                <p className={`mt-3 text-2xl font-medium tracking-[-0.03em] ${issued ? "text-ink" : ""}`}>{ticket?.event.title ?? item.name}</p>
                {ticket && (
                  <p className="mt-1 text-[13px] text-muted">
                    {formatDate(ticket.event.startsAt)} · {formatTime(ticket.event.startsAt)} · {ticket.event.venue}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
                  <span>
                    <span className="text-muted">Ticket </span>
                    {ticket?.tier.name ?? item.name}
                  </span>
                  <span>
                    <span className="text-muted">Price </span>
                    {item.unitPrice} tUSD8
                  </span>
                  <span className="text-muted">
                    {index} of {item.quantity}
                  </span>
                </div>
              </div>
              <div className="flex w-28 flex-col items-center justify-center gap-2 border-l border-dashed border-line p-4 sm:w-36">
                <Barcode value={code} className={`h-16 w-full ${issued ? "text-ink" : "text-line"}`} />
                <span className="break-all text-center font-mono text-[10px] tracking-wider">{code}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Receipt */}
      <section className="mt-12 grid gap-10 border-t border-line pt-10 sm:grid-cols-2">
        <div>
          <h2 className={eyebrow}>Receipt</h2>
          <ul className="mt-4 space-y-2 text-[15px]">
            {order.items.map((item) => (
              <li key={item.ticketId} className="flex justify-between gap-4">
                <span className="min-w-0">
                  {item.quantity} × {item.name}
                </span>
                <span className="shrink-0 tabular-nums">{times(item.unitPrice, item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-ink pt-4 font-medium">
            <span>Total</span>
            <span data-testid="order-total">{order.total} tUSD8</span>
          </div>
          {order.refunded !== "0.00" && (
            <div className="mt-1 flex justify-between text-sm text-muted">
              <span>Refunded</span>
              <span>{order.refunded} tUSD8</span>
            </div>
          )}
          <dl className="mt-8 space-y-3 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Paid by</dt>
              <dd className="font-mono">{order.paidBy ? shortAddress(order.paidBy) : order.payer ? `only ${shortAddress(order.payer)}` : "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Aevify payment</dt>
              <dd className="min-w-0 break-all text-right font-mono">{order.paymentId ?? "—"}</dd>
            </div>
            {order.txHash && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Transaction</dt>
                <dd className="font-mono">
                  {order.explorerTxUrl ? (
                    <a href={order.explorerTxUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                      {shortAddress(order.txHash)} ↗
                    </a>
                  ) : (
                    shortAddress(order.txHash)
                  )}
                </dd>
              </div>
            )}
          </dl>
        </div>
        <div>
          <h2 className={eyebrow}>Timeline</h2>
          <ol className="mt-4 space-y-4">
            {order.timeline.map((t, i) => (
              <li key={i} className="grid grid-cols-[auto_1fr] gap-x-3 text-[13px]">
                <span className="mt-1.5 size-1.5 rounded-full bg-ink" />
                <div className="min-w-0">
                  <p className="[overflow-wrap:anywhere]">{t.text}</p>
                  <p className="font-mono text-[11px] text-muted">{new Date(t.at).toLocaleTimeString()}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/#events" className={buttonSecondary}>
          More events
        </Link>
        <Link href="/orders" className={buttonSecondary}>
          Live sales
        </Link>
      </div>
    </div>
  );
}
