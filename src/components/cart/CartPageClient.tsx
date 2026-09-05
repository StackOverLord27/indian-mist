"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCartStore } from "@/lib/cart-store";
import { EmptyCart } from "@/components/cart/EmptyCart";
import { CartItemList } from "@/components/cart/CartItemList";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { RelatedProducts } from "@/components/product/RelatedProducts";

export function CartPageClient() {
  const router = useRouter();
  const { items, getTotal, getItemCount } = useCartStore();
  const checkoutBtnRef = useRef<HTMLButtonElement | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  // Intersection observer: show sticky mobile bar when checkout button scrolls out of view
  useEffect(() => {
    const btn = checkoutBtnRef.current;
    if (!btn) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(btn);
    return () => observer.disconnect();
  }, [items.length]); // re-init if cart empties/fills

  const itemCount = getItemCount();
  const total = getTotal();
  const formatPrice = (p: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(p);

  return (
    <>
      <div className="bg-cornsilk min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-6 pb-20 lg:pb-20">

          {/* Breadcrumb */}
          <nav className="pb-2 flex items-center font-montserrat text-xs text-muted-text">
            <Link href="/" className="hover:text-olive cursor-pointer transition-colors">
              Home
            </Link>
            <span className="mx-2 text-muted-text/40">›</span>
            <span className="text-forest font-medium">Bag</span>
          </nav>

          {/* Page header */}
          <h1 className="font-merriweather text-2xl md:text-3xl font-normal text-forest mt-2 mb-1">
            {itemCount === 0
              ? "Your bag"
              : `${itemCount} item${itemCount !== 1 ? "s" : ""} in your bag`}
          </h1>
          <p className="font-montserrat text-xs text-muted-text font-normal mb-0">
            Review your selections before checkout
          </p>

          {items.length === 0 ? (
            <EmptyCart />
          ) : (
            <>
              {/* 2-column grid */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 mt-6">
                {/* Left — Items */}
                <CartItemList />

                {/* Right — Order Summary */}
                <OrderSummary checkoutRef={checkoutBtnRef} />
              </div>

              {/* You may also like */}
              <RelatedProducts
                productIds={items.map((i) => i.id).slice(0, 4)}
              />
            </>
          )}
        </div>
      </div>

      {/* Mobile sticky checkout bar */}
      {items.length > 0 && showStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-cornsilk border-t border-olive/15 p-4 flex justify-between items-center lg:hidden">
          <div>
            <p className="font-montserrat text-xs text-muted-text">Total</p>
            <p className="font-merriweather text-xl font-bold text-forest">
              {formatPrice(total)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/checkout")}
            className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-3 rounded-sm hover:bg-olive transition-colors min-h-[44px]"
          >
            Checkout
          </button>
        </div>
      )}
    </>
  );
}
