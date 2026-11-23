import Link from "next/link";
import { formatDate, fromPrice, type Event } from "@/lib/events";
import { Poster } from "./poster";

export function EventCard({ event }: { event: Event }) {
  return (
    <Link href={`/events/${event.id}`} className="group block" aria-label={event.title}>
      <div className="overflow-hidden rounded-xl">
        <Poster event={event} className="w-full transition duration-500 group-hover:scale-[1.02]" />
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{formatDate(event.startsAt)}</p>
          <h3 className="mt-1.5 text-lg font-medium tracking-[-0.02em]">{event.title}</h3>
          <p className="mt-0.5 text-[13px] text-muted">
            {event.venue}, {event.city}
          </p>
        </div>
        <p className="shrink-0 pt-5 text-right text-[13px] text-muted">
          from <span className="font-medium text-ink">{fromPrice(event)}</span>
        </p>
      </div>
    </Link>
  );
}
