import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Poster } from "@/components/poster";
import { eyebrow } from "@/components/ui";
import { env } from "@/lib/env";
import { formatDate, formatTime, getEvent } from "@/lib/events";
import { BuyPanel } from "./buy-panel";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const event = getEvent((await params).id);
  return { title: event?.title ?? "Not found" };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const event = getEvent((await params).id);
  if (!event) notFound();
  return (
    <div>
      <Link href="/#events" className="text-[13px] text-muted hover:text-ink">
        ← All events
      </Link>
      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-16">
        <div className="md:sticky md:top-24 md:self-start">
          <Poster event={event} className="w-full rounded-2xl" />
        </div>
        <div>
          <p className={eyebrow}>{event.category}</p>
          <h1 className="mt-4 text-5xl font-medium leading-[1] tracking-tightest sm:text-6xl">{event.title}</h1>
          <dl className="mt-8 grid grid-cols-2 gap-6 border-y border-line py-6 text-[15px]">
            <div>
              <dt className={eyebrow}>When</dt>
              <dd className="mt-1.5">
                {formatDate(event.startsAt)}
                <span className="block text-muted">{formatTime(event.startsAt)} WAT</span>
              </dd>
            </div>
            <div>
              <dt className={eyebrow}>Where</dt>
              <dd className="mt-1.5">
                {event.venue}
                <span className="block text-muted">{event.city}</span>
              </dd>
            </div>
          </dl>
          <p className="mt-8 text-[17px] leading-relaxed">{event.summary}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{event.description}</p>
          <BuyPanel event={event} aevifyUrl={env.aevifyUrl()} publishableKey={env.aevifyPublishableKey()} />
        </div>
      </div>
    </div>
  );
}
