export type OrderStatus = "pending" | "paid" | "partially_refunded" | "refunded" | "expired" | "failed";
export type Buyer = "customer" | "agent";

export type OrderItem = { ticketId: string; name: string; unitPrice: string; quantity: number };

export type TimelineEntry = { at: string; text: string };

export type Order = {
  _id: string;
  /** Short, human-friendly number shown to customers, e.g. AD-7Q2M. */
  number: string;
  items: OrderItem[];
  total: string;
  status: OrderStatus;
  buyer: Buyer;
  /** For agent orders: only this wallet may pay. */
  payer: string | null;
  paymentId: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
  paidBy: string | null;
  txHash: string | null;
  refunded: string;
  /** How the store learned it was paid. */
  confirmedBy: "webhook" | "api" | null;
  timeline: TimelineEntry[];
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  lastSyncAt: string | null;
};

/** What the store's API and pages return for an order. */
export type PublicOrder = Omit<Order, "_id" | "lastSyncAt"> & { id: string; explorerTxUrl: string | null };
