"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ChevronRight, Package, MapPin, FileText, CheckCircle2 } from "lucide-react";
import type { OrderData, OrderItemData } from "./types";

interface StatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
  description: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  PROCESSING: {
    label: "Processing",
    badgeClass: "bg-amber-100/80 text-amber-900 border border-amber-300/70",
    dotClass: "bg-amber-500",
    description: "Your order is being carefully packed and prepared.",
  },
  SHIPPED: {
    label: "Shipped",
    badgeClass: "bg-sky-100/80 text-sky-900 border border-sky-300/70",
    dotClass: "bg-sky-500",
    description: "Your package is on its way to you.",
  },
  DELIVERED: {
    label: "Delivered",
    badgeClass: "bg-emerald-100/80 text-emerald-900 border border-emerald-300/70",
    dotClass: "bg-emerald-500",
    description: "Package has been successfully delivered.",
  },
  CANCELLED: {
    label: "Cancelled",
    badgeClass: "bg-rose-100/80 text-rose-900 border border-rose-300/70",
    dotClass: "bg-rose-500",
    description: "This order has been cancelled.",
  },
};

function getStatusDetails(status: string): StatusConfig {
  const upper = status?.toUpperCase() || "PROCESSING";
  return (
    STATUS_CONFIG[upper] || {
      label: status || "Processing",
      badgeClass: "bg-stone-100 text-stone-800 border border-stone-300",
      dotClass: "bg-stone-500",
      description: "Order status update.",
    }
  );
}

function getItemImage(item: OrderItemData): string {
  if (item.image) return item.image;
  if (item.productId && typeof item.productId === "object") {
    if (Array.isArray(item.productId.images) && item.productId.images[0]?.url) {
      return item.productId.images[0].url;
    }
  }
  return "";
}

function getItemName(item: OrderItemData): string {
  if (item.name) return item.name;
  if (item.productId && typeof item.productId === "object" && item.productId.name) {
    return item.productId.name;
  }
  return "Product Item";
}

export function OrderHistory({ orders }: { orders: OrderData[] }) {
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  return (
    <div>
      {/* Table header row */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] border-b border-olive-leaf/15 bg-warm-mist px-6 py-4 gap-4 items-center">
        <p className="font-montserrat text-xs font-bold uppercase tracking-widest text-olive-leaf">Order</p>
        <p className="font-montserrat text-xs font-bold uppercase tracking-widest text-olive-leaf w-28 text-center">Date</p>
        <p className="font-montserrat text-xs font-bold uppercase tracking-widest text-olive-leaf w-14 text-center">Items</p>
        <p className="font-montserrat text-xs font-bold uppercase tracking-widest text-olive-leaf w-28 text-center">Status</p>
        <p className="font-montserrat text-xs font-bold uppercase tracking-widest text-olive-leaf w-24 text-right">Total</p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-8 py-20 text-center">
          <div className="size-12 rounded-full bg-olive-leaf/10 flex items-center justify-center text-olive-leaf">
            <Package className="size-6" />
          </div>
          <p className="font-merriweather text-lg font-normal text-olive-leaf">No orders placed yet</p>
          <p className="font-montserrat text-xs text-olive-leaf/60 max-w-sm">
            Your verified orders will appear here once payment is completed.
          </p>
          <Link
            href="/products"
            className="mt-2 inline-block bg-olive-leaf px-8 py-3 font-montserrat text-xs font-semibold uppercase tracking-widest text-cornsilk transition-opacity hover:opacity-85 rounded-sm"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-olive-leaf/10">
          {orders.map((order) => {
            const isExpanded = !!expandedOrders[order._id];
            const statusConfig = getStatusDetails(order.status);

            return (
              <div key={order._id} className="transition-colors">
                {/* Main Order Row */}
                <div
                  onClick={() => toggleExpand(order._id)}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-6 py-4 cursor-pointer hover:bg-warm-mist/50 transition-colors select-none"
                >
                  {/* ID + Toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-olive-leaf/60 hover:text-black-forest transition-colors p-0.5"
                      aria-label={isExpanded ? "Collapse order" : "Expand order"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </button>
                    <div>
                      <p className="font-merriweather text-sm md:text-base font-bold text-black-forest">
                        #{order._id.slice(-6).toUpperCase()}
                      </p>
                      <p className="font-montserrat text-[10px] text-olive-leaf/60 md:hidden">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Date */}
                  <p className="w-28 text-center font-montserrat text-xs font-medium text-olive-leaf/70">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>

                  {/* Items count */}
                  <p className="w-14 text-center font-montserrat text-sm font-semibold text-olive-leaf">
                    {order.items?.length || 0}
                  </p>

                  {/* Status Badge reflecting Admin Choice */}
                  <div className="w-28 flex justify-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-montserrat text-[10px] font-bold uppercase tracking-wider ${statusConfig.badgeClass}`}
                    >
                      <span className={`size-1.5 rounded-full ${statusConfig.dotClass}`} />
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Total */}
                  <p className="w-24 text-right font-merriweather text-sm md:text-base font-bold text-black-forest">
                    ₹{order.totalAmount.toLocaleString("en-IN")}
                  </p>
                </div>

                {/* Expanded Order Details Accordion */}
                {isExpanded && (
                  <div className="px-6 py-5 bg-warm/40 border-t border-b border-olive-leaf/10 space-y-6 animate-in fade-in-50 duration-200">
                    
                    {/* Status helper banner */}
                    <div className="flex items-start gap-3 p-3 bg-white/70 border border-olive-leaf/15 rounded-sm">
                      <div className="mt-0.5">
                        <CheckCircle2 className="size-4 text-olive-leaf" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-montserrat text-xs font-semibold text-forest">
                            Status: {statusConfig.label}
                          </span>
                          <span className="font-montserrat text-[10px] text-muted-text font-mono">
                            (Payment Verified)
                          </span>
                        </div>
                        <p className="font-montserrat text-xs text-muted-text">
                          {statusConfig.description}
                        </p>
                      </div>
                    </div>

                    {/* Product Items Breakdown */}
                    <div>
                      <h4 className="font-montserrat text-[11px] font-bold uppercase tracking-wider text-olive-leaf mb-3 flex items-center gap-2">
                        <Package className="size-3.5" />
                        Products in this Order ({order.items?.length || 0})
                      </h4>

                      <div className="space-y-3">
                        {order.items?.map((item, idx) => {
                          const itemImg = getItemImage(item);
                          const itemName = getItemName(item);

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-4 p-3 bg-white/80 border border-olive-leaf/15 rounded-sm"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative size-14 shrink-0 rounded-sm overflow-hidden bg-cornsilk border border-olive-leaf/20 flex items-center justify-center">
                                  {itemImg ? (
                                    <Image
                                      src={itemImg}
                                      alt={itemName}
                                      fill
                                      className="object-cover"
                                      sizes="56px"
                                    />
                                  ) : (
                                    <Package className="size-6 text-olive-leaf/40" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-montserrat text-xs md:text-sm font-semibold text-forest truncate">
                                    {itemName}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 mt-0.5 font-montserrat text-[11px] text-muted-text">
                                    {item.selectedSize && (
                                      <span>Size: <strong className="text-forest">{item.selectedSize}</strong></span>
                                    )}
                                    {item.selectedSize && item.selectedColor && <span>•</span>}
                                    {item.selectedColor && (
                                      <span>Color: <strong className="text-forest">{item.selectedColor}</strong></span>
                                    )}
                                  </div>
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <span className="font-montserrat text-[10px] text-forest/70 font-medium">
                                      Status:
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-montserrat text-[9px] font-bold uppercase tracking-wider ${statusConfig.badgeClass}`}>
                                      <span className={`size-1 rounded-full ${statusConfig.dotClass}`} />
                                      {statusConfig.label}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="font-merriweather text-xs md:text-sm font-bold text-forest">
                                  ₹{(item.priceAtPurchase * item.quantity).toLocaleString("en-IN")}
                                </p>
                                <p className="font-montserrat text-[10px] text-muted-text">
                                  Qty: {item.quantity} × ₹{item.priceAtPurchase.toLocaleString("en-IN")}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Delivery & Pricing Breakdown Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-olive-leaf/10">
                      
                      {/* Shipping Address & Delivery Notes */}
                      <div className="space-y-3">
                        {order.shippingAddress && (
                          <div className="p-3 bg-white/60 border border-olive-leaf/15 rounded-sm space-y-1">
                            <div className="flex items-center gap-1.5 font-montserrat text-[10px] font-bold uppercase tracking-wider text-olive-leaf">
                              <MapPin className="size-3" />
                              Shipping Address
                            </div>
                            <p className="font-montserrat text-xs text-forest">
                              {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                            </p>
                            <p className="font-montserrat text-[11px] text-muted-text">
                              {order.shippingAddress.country || "India"}
                            </p>
                          </div>
                        )}

                        {order.deliveryNotes && (
                          <div className="p-3 bg-white/60 border border-olive-leaf/15 rounded-sm space-y-1">
                            <div className="flex items-center gap-1.5 font-montserrat text-[10px] font-bold uppercase tracking-wider text-olive-leaf">
                              <FileText className="size-3" />
                              Delivery Instructions
                            </div>
                            <p className="font-montserrat text-xs text-forest italic">
                              &ldquo;{order.deliveryNotes}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Payment Summary */}
                      <div className="p-3 bg-white/60 border border-olive-leaf/15 rounded-sm space-y-2">
                        <p className="font-montserrat text-[10px] font-bold uppercase tracking-wider text-olive-leaf">
                          Order Summary
                        </p>
                        <div className="space-y-1 text-xs font-montserrat text-muted-text">
                          {order.subtotal !== undefined && (
                            <div className="flex justify-between">
                              <span>Subtotal</span>
                              <span>₹{order.subtotal.toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          {order.discountAmount !== undefined && order.discountAmount > 0 && (
                            <div className="flex justify-between text-forest font-semibold">
                              <span>Discount {order.promoCode ? `(${order.promoCode})` : ""}</span>
                              <span>-₹{order.discountAmount.toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          {order.shippingCost !== undefined && (
                            <div className="flex justify-between">
                              <span>Shipping</span>
                              <span>{order.shippingCost === 0 ? "FREE" : `₹${order.shippingCost}`}</span>
                            </div>
                          )}
                          {order.taxAmount !== undefined && order.taxAmount > 0 && (
                            <div className="flex justify-between">
                              <span>Taxes</span>
                              <span>₹{order.taxAmount.toLocaleString("en-IN")}</span>
                            </div>
                          )}
                          <div className="border-t border-olive-leaf/15 pt-1.5 flex justify-between font-merriweather text-sm font-bold text-forest">
                            <span>Total Paid</span>
                            <span>₹{order.totalAmount.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
