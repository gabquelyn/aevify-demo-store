export const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-40";
export const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-medium text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-40";

/** Small uppercase monospace label. */
export const eyebrow = "font-mono text-[11px] uppercase tracking-[0.14em] text-muted";

export function Spinner({ className = "size-4" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-[1.5px] border-current border-r-transparent ${className}`} aria-hidden="true" />;
}
