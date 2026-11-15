import mongoose from "mongoose";
import { Order } from "@/models/order.model";

/**
 * Is the orders collection's razorpayOrderId index the unique, sparse one the model declares?
 * The live database once had a PLAIN index of that name, which Mongoose cannot replace (it only
 * emits an event), and two orders were then created for one payment. The order code no longer
 * depends on this index (see order-id.ts), but a missing guarantee must never be silent again.
 *
 * The result is cached per server instance and re-checked at most every 10 minutes (one cheap
 * `listIndexes` call), so the admin page can show it without a query per page view.
 */
export type OrdersIndexHealth = { ok: boolean; problem?: string; checkedAt: number };

const RECHECK_MS = 10 * 60 * 1000;

type Index = { name?: string; key?: Record<string, unknown>; unique?: boolean; sparse?: boolean };

/** Pure: what is wrong with this list of live indexes, if anything. */
export function evaluateOrdersIndexes(indexes: Index[]): { ok: boolean; problem?: string } {
  const ix = indexes.find((i) => i.key && Object.keys(i.key).length === 1 && i.key.razorpayOrderId === 1);
  if (!ix) return { ok: false, problem: "there is no index on orders.razorpayOrderId" };
  const missing = [!ix.unique && "unique", !ix.sparse && "sparse"].filter(Boolean);
  if (missing.length) return { ok: false, problem: `the index ${ix.name ?? "on orders.razorpayOrderId"} is not ${missing.join(" and ")}` };
  return { ok: true };
}

declare global {
  var _ordersIndexHealth: OrdersIndexHealth | undefined;
  var _ordersIndexCriticalLogged: boolean | undefined;
}

/** Checks the live collection now (after Mongoose has finished its own index build). Never throws. */
export async function checkOrdersIndexNow(): Promise<OrdersIndexHealth> {
  try {
    await Order.init().catch(() => {}); // wait for the index build to finish, whatever its result
    const live = await mongoose.connection.db!.collection(Order.collection.name).indexes().catch((e: { codeName?: string }) => {
      if (e?.codeName === "NamespaceNotFound") return null; // no orders yet: the first order creates the collection
      throw e;
    });
    const result = live === null ? { ok: true } : evaluateOrdersIndexes(live as Index[]);
    const health: OrdersIndexHealth = { ...result, checkedAt: Date.now() };
    globalThis._ordersIndexHealth = health;
    if (!health.ok && !globalThis._ordersIndexCriticalLogged) {
      globalThis._ordersIndexCriticalLogged = true;
      console.error(
        `[db] CRITICAL: ${health.problem}. The database does not guarantee one order per payment (the app still enforces it itself). Fix: npm run ensure:indexes (report), then npm run ensure:indexes -- --apply`,
      );
    }
    return health;
  } catch (error) {
    console.error("[db] could not check the orders indexes:", error instanceof Error ? error.message : "unknown");
    return globalThis._ordersIndexHealth ?? { ok: true, checkedAt: Date.now() }; // unknown is not reported as broken
  }
}

/** The cached answer; re-checks when older than 10 minutes. */
export async function getOrdersIndexHealth(): Promise<OrdersIndexHealth> {
  const cached = globalThis._ordersIndexHealth;
  if (cached && Date.now() - cached.checkedAt < RECHECK_MS) return cached;
  return checkOrdersIndexNow();
}

export function resetDbHealthForTests() {
  globalThis._ordersIndexHealth = undefined;
  globalThis._ordersIndexCriticalLogged = undefined;
}
