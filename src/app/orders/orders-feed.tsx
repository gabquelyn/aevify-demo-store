"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BuyerBadge, shortAddress, StatusBadge, timeAgo } from "@/components/status";
import { Spinner } from "@/components/ui";
import type { PublicOrder } from "@/lib/types";

export function OrdersFeed() {
  const [orders, setOrders] = useState<PublicOrder[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const res = await fetch("/api/orders?limit=30", { cache: "no-store" });
        const body = await res.json();
        if (!stop && res.ok) {
          setOrders(body.data);
          setNow(Date.now());
        }
      } finally {
        if (!stop) timer = setTimeout(load, 3000);
      }
    }
    void load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, []);

  if (!orders) {
    return (
      <div className="grid place-items-center py-20 text-muted">
        <Spinner className="size-5" />
      </div>
    );
  }
  if (orders.length === 0) {
    return <p className="mt-12 border-t border-ink pt-10 text-muted">No sales yet. The first one shows up here within seconds.</p>;
  }
  return (
    <ul className="mt-12 border-t border-ink" data-testid="orders-feed">
      {orders.map((o) => {
        const count = o.items.reduce((n, i) => n + i.quantity, 0);
        return (
          <li key={o.id} className="border-b border-line">
            <Link href={`/orders/${o.id}`} className="grid gap-x-6 gap-y-2 py-5 transition hover:bg-surface sm:grid-cols-[1fr_auto] sm:px-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="font-mono text-[13px]">{o.number}</span>
                  <StatusBadge status={o.status} />
                  <BuyerBadge buyer={o.buyer} />
                </div>
                <p className="mt-2 truncate text-[15px]">
                  {count} × {o.items.map((i) => i.name).join(", ")}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-[15px] font-medium tabular-nums">{o.total} tUSD8</p>
                <p className="mt-1 font-mono text-[11px] text-muted">
                  {o.paidBy ? `${shortAddress(o.paidBy)} · ` : ""}
                  {timeAgo(o.paidAt ?? o.createdAt, now)}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
