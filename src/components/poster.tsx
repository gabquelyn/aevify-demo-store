import { dayMonth, type Event } from "@/lib/events";

/** A black-and-white typographic poster for each event (no photos needed). */
export function Poster({ event, className = "" }: { event: Event; className?: string }) {
  const { day, month } = dayMonth(event.startsAt);
  return (
    <svg viewBox="0 0 400 500" className={`block bg-ink ${className}`} role="img" aria-label={`${event.title} poster`}>
      <rect width="400" height="500" fill="#0a0a0a" />
      <g fill="none" stroke="#ffffff">
        <Pattern style={event.poster} />
      </g>
      <text x="28" y="44" fill="#ffffff" fontFamily="var(--font-geist-mono), monospace" fontSize="13" letterSpacing="2.5" opacity="0.7">
        {event.category.toUpperCase()}
      </text>
      <text x="372" y="44" fill="#ffffff" fontFamily="var(--font-geist-mono), monospace" fontSize="13" letterSpacing="2.5" opacity="0.7" textAnchor="end">
        {event.city.toUpperCase()}
      </text>
      <text x="24" y="458" fill="#ffffff" fontFamily="var(--font-geist-sans), sans-serif" fontSize="150" fontWeight="500" letterSpacing="-8">
        {day}
      </text>
      <text x="372" y="458" fill="#ffffff" fontFamily="var(--font-geist-mono), monospace" fontSize="22" letterSpacing="3" textAnchor="end">
        {month}
      </text>
    </svg>
  );
}

function Pattern({ style }: { style: Event["poster"] }) {
  switch (style) {
    case "rings":
      return (
        <g strokeWidth="1.2" opacity="0.9">
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={i} cx="262" cy="220" r={12 + i * 15} />
          ))}
        </g>
      );
    case "grid":
      return (
        <g strokeWidth="1" opacity="0.85">
          {Array.from({ length: 9 }, (_, r) =>
            Array.from({ length: 9 }, (_, c) => {
              const filled = (r * 7 + c * 3) % 5 === 0;
              return <rect key={`${r}-${c}`} x={36 + c * 37} y={70 + r * 30} width="26" height="20" fill={filled ? "#ffffff" : "none"} />;
            }),
          )}
        </g>
      );
    case "stripes":
      return (
        <g strokeWidth="9" opacity="0.95">
          {Array.from({ length: 13 }, (_, i) => (
            <line key={i} x1={-120 + i * 42} y1="340" x2={80 + i * 42} y2="70" />
          ))}
        </g>
      );
    case "dots":
      return (
        <g stroke="none" fill="#ffffff">
          {Array.from({ length: 10 }, (_, r) =>
            Array.from({ length: 12 }, (_, c) => (
              <circle key={`${r}-${c}`} cx={36 + c * 30} cy={82 + r * 28} r={1.5 + ((r + c) % 4) * 1.6} />
            )),
          )}
        </g>
      );
    case "wave":
      return (
        <g strokeWidth="1.3" opacity="0.9">
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d={`M0 ${90 + i * 17} C 100 ${60 + i * 17}, 180 ${130 + i * 17}, 260 ${92 + i * 17} S 380 ${70 + i * 17}, 400 ${88 + i * 17}`} />
          ))}
        </g>
      );
    case "arc":
      return (
        <g strokeWidth="1.2" opacity="0.9">
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M ${40 + i * 6} 340 A ${160 - i * 11} ${160 - i * 11} 0 0 1 ${360 - i * 6} 340`} />
          ))}
          <line x1="28" y1="340" x2="372" y2="340" />
        </g>
      );
  }
}
