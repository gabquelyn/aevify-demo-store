import type { Buyer, OrderStatus } from "@/lib/types";

const STATUS: Record<OrderStatus, { label: string; className: string; dot?: boolean }> = {
  pending: { label: "Awaiting payment", className: "border border-line text-ink", dot: true },
  paid: { label: "Paid", className: "bg-ink text-paper" },
  partially_refunded: { label: "Partly refunded", className: "border border-ink text-ink" },
  refunded: { label: "Refunded", className: "border border-line text-muted" },
  expired: { label: "Expired", className: "border border-line text-muted" },
  failed: { label: "Failed", className: "border border-line text-muted line-through" },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${s.className}`}>
      {s.dot && <span className="pulse-dot size-1.5 rounded-full bg-ink" />}
      {s.label}
    </span>
  );
}

export function BuyerBadge({ buyer }: { buyer: Buyer }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted">
      {buyer === "agent" ? <AgentIcon className="size-3.5 text-ink" /> : <PersonIcon className="size-3.5 text-ink" />}
      {buyer === "agent" ? "AI agent" : "Customer"}
    </span>
  );
}

export function AgentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5" />
    </svg>
  );
}

export function PersonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function shortAddress(a: string | null | undefined): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}
