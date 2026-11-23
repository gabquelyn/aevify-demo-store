import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { Poster } from "@/components/poster";
import { env } from "@/lib/env";
import { EVENTS } from "@/lib/events";

/**
 * DEV ONLY (STORE_TEST_MODE=memory): the 1200×630 social card, built from the site's own pieces.
 * Captured to public/og.png by scripts/og-image.py. 404 otherwise.
 */
export default function OgCard() {
  if (!env.memoryMode()) notFound();
  const [a, b] = [EVENTS[0]!, EVENTS[1]!];
  return (
    <div id="og" className="fixed left-0 top-0 z-[100] flex h-[630px] w-[1200px] overflow-hidden bg-paper">
      <div className="flex flex-1 flex-col justify-between py-16 pl-[72px] pr-8">
        <Logo className="text-ink [&_span]:text-[30px] [&_svg]:size-8" />
        <div>
          <h1 className="text-[96px] font-medium leading-[0.92] tracking-tightest">
            Tickets,
            <br />
            paid in
            <br />
            <span className="text-faint">stablecoins.</span>
          </h1>
        </div>
        <p className="font-mono text-[15px] uppercase tracking-[0.16em] text-muted">Events · tUSD8 on QDay Aevum · Payments by Aevify</p>
      </div>
      <div className="relative w-[470px] shrink-0">
        <div className="absolute left-4 top-14 w-[250px] rotate-[-7deg] overflow-hidden rounded-2xl shadow-2xl">
          <Poster event={b} className="w-full" />
        </div>
        <div className="absolute left-[175px] top-[150px] w-[265px] rotate-[5deg] overflow-hidden rounded-2xl shadow-2xl ring-8 ring-paper">
          <Poster event={a} className="w-full" />
        </div>
      </div>
    </div>
  );
}
