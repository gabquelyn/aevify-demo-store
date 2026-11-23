import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { Poster } from "@/components/poster";
import { buttonPrimary, buttonSecondary, eyebrow } from "@/components/ui";
import { EVENTS, formatDate, fromPrice } from "@/lib/events";

export default function Home() {
  const featured = EVENTS[0]!;
  const upcoming = [...EVENTS].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <div className="space-y-24 sm:space-y-32">
      {/* Hero */}
      <section className="grid items-end gap-10 md:grid-cols-[1.25fr_1fr] md:gap-16">
        <div>
          <p className={eyebrow}>Admit · Lagos, Abuja</p>
          <h1 className="mt-6 text-[52px] font-medium leading-[0.95] tracking-tightest sm:text-[84px]">
            Tickets,
            <br />
            paid in
            <br />
            <span className="text-faint">stablecoins.</span>
          </h1>
          <p className="mt-8 max-w-md text-[17px] leading-relaxed text-muted">
            Pick an event, pay in tUSD8 from your wallet, and your tickets are issued the moment the payment settles on Aevum. AI agents
            book the same way.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#events" className={buttonPrimary}>
              Browse events
            </a>
            <Link href="/agent" className={buttonSecondary}>
              Watch an agent book →
            </Link>
          </div>
        </div>
        <Link href={`/events/${featured.id}`} className="group block">
          <div className="overflow-hidden rounded-2xl">
            <Poster event={featured} className="w-full transition duration-500 group-hover:scale-[1.02]" />
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-4 text-[13px]">
            <span>
              <span className="font-medium">{featured.title}</span> <span className="text-muted">· {formatDate(featured.startsAt)}</span>
            </span>
            <span className="text-muted">from {fromPrice(featured)} tUSD8</span>
          </div>
        </Link>
      </section>

      {/* Events */}
      <section id="events" className="scroll-mt-24">
        <div className="flex items-end justify-between border-b border-ink pb-4">
          <h2 className="text-3xl font-medium tracking-[-0.03em]">Upcoming</h2>
          <p className={eyebrow}>{upcoming.length} events · prices in tUSD8</p>
        </div>
        <div className="mt-10 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="grid gap-10 border-t border-line pt-12 md:grid-cols-3">
        {[
          ["01", "Choose your tickets", "Prices come from the organiser, so there's nothing to type and nothing to get wrong."],
          ["02", "Pay from your wallet", "Aevify's checkout opens right here. Confirm the tUSD8 payment on QDay Aevum."],
          ["03", "Get in", "Tickets are issued as soon as Aevify confirms the payment with a signed webhook."],
        ].map(([n, title, text]) => (
          <div key={n}>
            <p className="font-mono text-[11px] text-muted">{n}</p>
            <h3 className="mt-3 text-lg font-medium tracking-[-0.02em]">{title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </section>

      {/* Agents */}
      <section className="rounded-2xl bg-ink px-6 py-14 text-paper sm:px-14 sm:py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">For AI agents</p>
        <h2 className="mt-5 max-w-2xl text-4xl font-medium leading-[1.05] tracking-[-0.035em] sm:text-5xl">
          Agents book tickets too, within the limits you set.
        </h2>
        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-faint">
          Our demo agent books conference passes for a team. It verifies every payment detail, pays on Aevum from its own wallet, and asks
          a human when an order breaks its budget.
        </p>
        <Link href="/agent" className="mt-10 inline-flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-surface">
          See it work →
        </Link>
      </section>
    </div>
  );
}
