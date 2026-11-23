/** A decorative barcode derived from the ticket code (deterministic, not scannable). */
export function Barcode({ value, className = "" }: { value: string; className?: string }) {
  let h = 2166136261;
  const bars: number[] = [];
  for (let i = 0; i < 44; i++) {
    h ^= value.charCodeAt(i % value.length) + i;
    h = Math.imul(h, 16777619) >>> 0;
    bars.push((h % 3) + 1);
  }
  let x = 0;
  const rects = bars.map((w, i) => {
    const rect = i % 2 === 0 ? <rect key={i} x={x} y="0" width={w} height="40" /> : null;
    x += w;
    return rect;
  });
  return (
    <svg viewBox={`0 0 ${x} 40`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <g fill="currentColor">{rects}</g>
    </svg>
  );
}
