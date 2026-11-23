import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "./env";
import type { Order } from "./types";

/**
 * Order storage: MongoDB (its own database, separate from Aevify's), or in-memory for tests.
 * Everything the store needs goes through this small interface.
 */
export interface Store {
  insertOrder(order: Order): Promise<void>;
  getOrder(id: string): Promise<Order | null>;
  updateOrder(id: string, patch: Partial<Order>, pushTimeline?: Order["timeline"]): Promise<Order | null>;
  recentOrders(limit: number): Promise<Order[]>;
  /** Total of orders paid by `payer` since `since`. */
  paidTotalSince(payer: string, since: Date): Promise<string[]>;
  /** Remember a webhook event ID. false if it was already processed. */
  markEventProcessed(eventId: string, type: string): Promise<boolean>;
  /** Simple lease so only one agent run happens at a time. */
  acquireLock(name: string, ttlMs: number): Promise<boolean>;
  releaseLock(name: string): Promise<void>;
}

type EventDoc = { _id: string; type: string; receivedAt: Date };
type LockDoc = { _id: string; until: Date };

class MongoStore implements Store {
  private ready: Promise<void> | null = null;
  constructor(private db: Db) {}

  private get orders(): Collection<Order> {
    return this.db.collection<Order>("orders");
  }
  private get events(): Collection<EventDoc> {
    return this.db.collection<EventDoc>("webhook_events");
  }
  private get locks(): Collection<LockDoc> {
    return this.db.collection<LockDoc>("locks");
  }

  private indexes() {
    this.ready ??= (async () => {
      await this.orders.createIndex({ createdAt: -1 });
      await this.orders.createIndex({ paymentId: 1 }, { sparse: true });
      await this.orders.createIndex({ payer: 1, paidAt: -1 });
      await this.events.createIndex({ receivedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
    })().catch((e) => {
      this.ready = null;
      throw e;
    });
    return this.ready;
  }

  async insertOrder(order: Order) {
    await this.indexes();
    await this.orders.insertOne(order);
  }
  async getOrder(id: string) {
    return this.orders.findOne({ _id: id });
  }
  async updateOrder(id: string, patch: Partial<Order>, pushTimeline: Order["timeline"] = []) {
    const update: Record<string, unknown> = { $set: { ...patch, updatedAt: new Date().toISOString() } };
    if (pushTimeline.length) update.$push = { timeline: { $each: pushTimeline } };
    return this.orders.findOneAndUpdate({ _id: id }, update, { returnDocument: "after" });
  }
  async recentOrders(limit: number) {
    return this.orders.find({ status: { $ne: "failed" } }).sort({ createdAt: -1 }).limit(limit).toArray();
  }
  async paidTotalSince(payer: string, since: Date) {
    const docs = await this.orders
      .find({ paidBy: { $regex: `^${payer}$`, $options: "i" }, paidAt: { $gte: since.toISOString() } })
      .project<{ total: string }>({ total: 1 })
      .toArray();
    return docs.map((d) => d.total);
  }
  async markEventProcessed(eventId: string, type: string) {
    await this.indexes();
    try {
      await this.events.insertOne({ _id: eventId, type, receivedAt: new Date() });
      return true;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) return false;
      throw e;
    }
  }
  async acquireLock(name: string, ttlMs: number) {
    const now = new Date();
    try {
      const res = await this.locks.findOneAndUpdate(
        { _id: name, until: { $lt: now } },
        { $set: { until: new Date(now.getTime() + ttlMs) } },
        { upsert: true, returnDocument: "after" },
      );
      return res !== null;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) return false; // held by someone else
      throw e;
    }
  }
  async releaseLock(name: string) {
    await this.locks.deleteOne({ _id: name });
  }
}

class MemoryStore implements Store {
  orders = new Map<string, Order>();
  events = new Set<string>();
  locks = new Map<string, number>();

  async insertOrder(order: Order) {
    this.orders.set(order._id, structuredClone(order));
  }
  async getOrder(id: string) {
    const o = this.orders.get(id);
    return o ? structuredClone(o) : null;
  }
  async updateOrder(id: string, patch: Partial<Order>, pushTimeline: Order["timeline"] = []) {
    const o = this.orders.get(id);
    if (!o) return null;
    const next = { ...o, ...patch, timeline: [...o.timeline, ...pushTimeline], updatedAt: new Date().toISOString() };
    this.orders.set(id, next);
    return structuredClone(next);
  }
  async recentOrders(limit: number) {
    return [...this.orders.values()]
      .filter((o) => o.status !== "failed")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((o) => structuredClone(o));
  }
  async paidTotalSince(payer: string, since: Date) {
    return [...this.orders.values()]
      .filter((o) => o.paidBy?.toLowerCase() === payer.toLowerCase() && o.paidAt && o.paidAt >= since.toISOString())
      .map((o) => o.total);
  }
  async markEventProcessed(eventId: string) {
    if (this.events.has(eventId)) return false;
    this.events.add(eventId);
    return true;
  }
  async acquireLock(name: string, ttlMs: number) {
    const until = this.locks.get(name) ?? 0;
    if (until > Date.now()) return false;
    this.locks.set(name, Date.now() + ttlMs);
    return true;
  }
  async releaseLock(name: string) {
    this.locks.delete(name);
  }
}

const globalForStore = globalThis as unknown as { admitStore?: Store; admitMongo?: MongoClient };

export function getStore(): Store {
  if (globalForStore.admitStore) return globalForStore.admitStore;
  if (env.memoryMode()) {
    globalForStore.admitStore = new MemoryStore();
  } else {
    globalForStore.admitMongo ??= new MongoClient(env.mongoUri(), { appName: "admit-tickets" });
    globalForStore.admitStore = new MongoStore(globalForStore.admitMongo.db(env.mongoDb()));
  }
  return globalForStore.admitStore;
}

/** Tests only: use a fresh in-memory store. */
export function resetMemoryStore(): MemoryStore {
  const store = new MemoryStore();
  globalForStore.admitStore = store;
  return store;
}
