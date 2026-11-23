import { NextResponse } from "next/server";
import { EVENTS } from "@/lib/events";

/** GET /api/tickets: every ticket on sale (people browse the pages; agents read this). */
export function GET() {
  return NextResponse.json({
    object: "list",
    currency: "tUSD8",
    data: EVENTS.flatMap((event) =>
      event.tiers.map((tier) => ({
        id: `${event.id}.${tier.id}`,
        name: `${event.title}: ${tier.name}`,
        price: tier.price,
        event: { id: event.id, title: event.title, startsAt: event.startsAt, venue: event.venue, city: event.city },
        tier: tier.name,
        perks: tier.perks,
      })),
    ),
  });
}
