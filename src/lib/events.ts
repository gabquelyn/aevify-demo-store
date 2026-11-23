/** Admit's events and ticket tiers. Prices are in tUSD8 (testnet stablecoin, 6 decimals). */

export type PosterStyle = "rings" | "grid" | "stripes" | "dots" | "wave" | "arc";

export type Tier = { id: string; name: string; price: string; perks: string[] };

export type Event = {
  id: string;
  title: string;
  category: "Conference" | "Music" | "Design" | "Film" | "Meetup";
  /** ISO date-time, Africa/Lagos. */
  startsAt: string;
  venue: string;
  city: string;
  summary: string;
  description: string;
  poster: PosterStyle;
  tiers: Tier[];
};

export const EVENTS: Event[] = [
  {
    id: "lagos-tech-summit",
    title: "Lagos Tech Summit",
    category: "Conference",
    startsAt: "2027-02-12T09:00:00+01:00",
    venue: "Landmark Centre",
    city: "Lagos",
    summary: "Two days of founders, engineers and investors building West Africa's software.",
    description:
      "Keynotes, deep-dive workshops and a startup floor with more than 120 companies. Passes include lunch on both days and access to the evening reception.",
    poster: "grid",
    tiers: [
      { id: "general", name: "General", price: "9.00", perks: ["Both days", "Keynotes and expo floor"] },
      { id: "builder", name: "Builder", price: "15.00", perks: ["Everything in General", "Hands-on workshops"] },
      { id: "vip", name: "VIP", price: "24.00", perks: ["Everything in Builder", "Speaker dinner", "Front rows"] },
    ],
  },
  {
    id: "eko-night-sessions",
    title: "Eko Night Sessions",
    category: "Music",
    startsAt: "2026-12-19T20:00:00+01:00",
    venue: "The Hall, Victoria Island",
    city: "Lagos",
    summary: "A late-night live set: Afrobeats, highlife and a full horn section.",
    description: "Doors at 8 pm, music until late. Standing room on the floor, or a reserved table for four on the mezzanine.",
    poster: "rings",
    tiers: [
      { id: "floor", name: "Floor", price: "6.00", perks: ["Standing"] },
      { id: "table", name: "Mezzanine table", price: "20.00", perks: ["Reserved table for four", "Table service"] },
    ],
  },
  {
    id: "abuja-design-week",
    title: "Abuja Design Week",
    category: "Design",
    startsAt: "2027-01-23T10:00:00+01:00",
    venue: "Thought Pyramid",
    city: "Abuja",
    summary: "Exhibitions, talks and studio visits across the capital.",
    description: "Seven days of architecture, furniture, type and product design. A day pass covers every venue for one day.",
    poster: "stripes",
    tiers: [
      { id: "day", name: "Day pass", price: "4.00", perks: ["One day, all venues"] },
      { id: "week", name: "Full week", price: "12.00", perks: ["All seven days", "Studio visits"] },
    ],
  },
  {
    id: "jazz-on-the-island",
    title: "Jazz on the Island",
    category: "Music",
    startsAt: "2027-01-09T18:30:00+01:00",
    venue: "Tarkwa Bay",
    city: "Lagos",
    summary: "An open-air jazz evening on the beach, boat transfer included.",
    description: "Boats leave the jetty from 5 pm. Bring a blanket; the music starts at sunset.",
    poster: "wave",
    tiers: [
      { id: "ga", name: "General", price: "7.00", perks: ["Boat transfer", "Beach access"] },
      { id: "front", name: "Front lawn", price: "18.00", perks: ["Boat transfer", "Seats by the stage"] },
    ],
  },
  {
    id: "midnight-classics",
    title: "Midnight Classics",
    category: "Film",
    startsAt: "2026-12-05T23:00:00+01:00",
    venue: "Rooftop Cinema, Ikoyi",
    city: "Lagos",
    summary: "A black-and-white double feature under the stars.",
    description: "Two restored classics back to back, with blankets and hot chocolate on the roof.",
    poster: "arc",
    tiers: [{ id: "seat", name: "Seat", price: "3.50", perks: ["Double feature"] }],
  },
  {
    id: "aevum-builders-meetup",
    title: "Aevum Builders Meetup",
    category: "Meetup",
    startsAt: "2026-12-13T17:00:00+01:00",
    venue: "Co-Creation Hub, Yaba",
    city: "Lagos",
    summary: "Demos and drinks with teams building on QDay Aevum.",
    description: "Short demos from builders on Aevum, then open floor. The ticket covers drinks.",
    poster: "dots",
    tiers: [{ id: "entry", name: "Entry", price: "1.00", perks: ["Drinks included"] }],
  },
];

export type Ticket = { id: string; eventId: string; tierId: string; name: string; price: string; event: Event; tier: Tier };

/** Ticket IDs are "<event>.<tier>", e.g. "lagos-tech-summit.general". */
export function getTicket(id: string): Ticket | undefined {
  const [eventId, tierId] = id.split(".");
  const event = EVENTS.find((e) => e.id === eventId);
  const tier = event?.tiers.find((t) => t.id === tierId);
  if (!event || !tier) return undefined;
  return { id, eventId: event.id, tierId: tier.id, name: `${event.title}: ${tier.name}`, price: tier.price, event, tier };
}

export function getEvent(id: string): Event | undefined {
  return EVENTS.find((e) => e.id === id);
}

export function fromPrice(event: Event): string {
  return event.tiers.map((t) => t.price).sort((a, b) => Number(a) - Number(b))[0]!;
}

const DATE = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "2-digit", timeZone: "Africa/Lagos" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "Africa/Lagos" });

export function formatDate(iso: string) {
  return DATE.format(new Date(iso));
}
export function formatTime(iso: string) {
  return TIME.format(new Date(iso));
}
export function dayMonth(iso: string) {
  return { day: DAY.format(new Date(iso)), month: MONTH.format(new Date(iso)).toUpperCase() };
}
