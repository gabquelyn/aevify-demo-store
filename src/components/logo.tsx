/** Admit wordmark: a ticket notch in a square, then the name. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M3 5h18v4.5a2.5 2.5 0 0 0 0 5V19H3v-4.5a2.5 2.5 0 0 0 0-5z" fill="currentColor" />
      <path d="M9 9v6M12 9v6M15 9v6" stroke="var(--color-paper)" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark className="size-5" />
      <span className="text-[17px] font-semibold tracking-[-0.03em]">Admit</span>
    </span>
  );
}
