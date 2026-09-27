import Link from "next/link";
import type { OrderData } from "./types";

const STATUS_COLOR: Record<string, string> = {
  PENDING:    "text-copperwood",
  PROCESSING: "text-copperwood",
  SHIPPED:    "text-olive-leaf",
  DELIVERED:  "text-olive-leaf",
  CANCELLED:  "text-red-600",
};

export function OrderHistory({ orders }: { orders: OrderData[] }) {
  return (
    <div>
      {/* Table header row */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] border-b border-olive-leaf/15 bg-warm-mist px-6 py-4 gap-4 items-center">
        <p className="font-montserrat text-xs font-bold uppercase tracking-widest text-olive-leaf">Order</p>
        <p className="font-montserrat text-xs font-bold uppercase tracking-widest text-olive-leaf w-24 text-center">Date</p>
        <p className="font-montserrat text-xs font-bold uppercase tracking-widest text-olive-leaf w-14 text-center">Items</p>
        <p className="font-montserrat text-xs font-bold uppercase tracking-widest text-olive-leaf w-24 text-center">Status</p>
        <p className="font-montserrat text-xs font-bold uppercase tracking-widest text-olive-leaf w-20 text-right">Total</p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-8 py-20 text-center">
          <p className="font-merriweather text-lg font-normal text-olive-leaf">No orders placed yet</p>
          <p className="font-montserrat text-xs text-olive-leaf/60">Your order history will appear here once you make a purchase.</p>
          <Link
            href="/products"
            className="mt-2 inline-block bg-olive-leaf px-8 py-3 font-montserrat text-xs font-semibold uppercase tracking-widest text-cornsilk transition-opacity hover:opacity-85"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-olive-leaf/10">
          {orders.map((order) => (
            <div
              key={order._id}
              className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-warm-mist/50"
            >
              {/* ID */}
              <p className="font-merriweather text-base font-normal text-black-forest">
                #{order._id.slice(-6).toUpperCase()}
              </p>

              {/* Date */}
              <p className="w-24 text-center font-montserrat text-xs font-medium text-olive-leaf/70">
                {new Date(order.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </p>

              {/* Items */}
              <p className="w-14 text-center font-montserrat text-sm font-semibold text-olive-leaf">
                {order.items.length}
              </p>

              {/* Status */}
              <p className={`w-24 text-center font-montserrat text-xs font-bold uppercase tracking-widest ${STATUS_COLOR[order.status] ?? "text-black-forest"}`}>
                {
                  order.status === "PROCESSING" || order.status === "SHIPPED"
                    ? "IN PROGRESS"
                    : order.status === "DELIVERED"
                    ? "COMPLETED"
                    : order.status
                }
              </p>

              {/* Total */}
              <p className="w-20 text-right font-merriweather text-base font-normal text-black-forest">
                ₹{order.totalAmount.toLocaleString("en-IN")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
