"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, RefreshCw, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";

const SHIPPING_THRESHOLD = 999;
const SHIPPING_COST = 99;
const GST_RATE = 0.18;

export function OrderSummary({
  checkoutRef,
}: {
  checkoutRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const { getTotal } = useCartStore();

  const subtotal = getTotal();
  const shippingFree = subtotal >= SHIPPING_THRESHOLD;
  const shipping = shippingFree ? 0 : SHIPPING_COST;
  const tax = Math.round((subtotal + shipping) * GST_RATE);
  const total = subtotal + shipping + tax;

  const freeShippingProgress = Math.min(
    (subtotal / SHIPPING_THRESHOLD) * 100,
    100
  );
  const remaining = Math.max(SHIPPING_THRESHOLD - subtotal, 0);

  const router = useRouter();

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  return (
    <div className="lg:sticky lg:top-20 bg-card border border-olive/10 rounded-md p-5 md:p-6">
      <h2 className="font-merriweather text-lg font-normal text-forest mb-5">
        Order Summary
      </h2>

      {/* Line items */}
      <div className="space-y-3 pb-5 border-b border-olive/10">
        <div className="flex justify-between items-center">
          <span className="font-montserrat text-sm font-normal text-muted-text">
            Subtotal
          </span>
          <span className="font-montserrat text-sm text-forest font-medium">
            {formatPrice(subtotal)}
          </span>
        </div>

        <div>
          <div className="flex justify-between items-center">
            <span className="font-montserrat text-sm font-normal text-muted-text">
              Shipping
            </span>
            <span
              className={cn(
                "font-montserrat text-sm font-medium",
                shippingFree ? "text-olive" : "text-forest"
              )}
            >
              {shippingFree ? "Free" : formatPrice(shipping)}
            </span>
          </div>
          {shippingFree && (
            <p className="text-[10px] text-olive font-montserrat mt-0.5">
              ✓ Free shipping unlocked
            </p>
          )}
        </div>

        <div className="flex justify-between items-center">
          <span className="font-montserrat text-sm font-normal text-muted-text">
            GST (18%)
          </span>
          <span className="font-montserrat text-sm text-forest font-medium">
            {formatPrice(tax)}
          </span>
        </div>
      </div>

      {/* Total */}
      <div className="pt-4 flex justify-between items-baseline">
        <span className="font-montserrat text-sm font-semibold text-forest uppercase tracking-wide">
          Total
        </span>
        <span className="font-merriweather text-2xl font-bold text-forest">
          {formatPrice(total)}
        </span>
      </div>

      {/* Free shipping progress */}
      {!shippingFree && (
        <div className="mt-4 pt-4 border-t border-olive/10">
          <p className="font-montserrat text-xs font-normal text-muted-text mb-2">
            Add {formatPrice(remaining)} more for free shipping
          </p>
          <div className="w-full h-1 bg-olive/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-olive rounded-full transition-all duration-500"
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Checkout button */}
      <Button
        ref={checkoutRef}
        onClick={() => router.push("/checkout")}
        className="mt-6 w-full bg-forest text-cornsilk hover:bg-olive font-montserrat text-xs font-semibold uppercase tracking-wider py-4 rounded-sm h-auto transition-colors flex items-center justify-center gap-2"
      >
        <LockKeyhole className="size-[13px]" />
        Proceed to Checkout
      </Button>

      {/* Trust signals */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-center gap-1.5">
          <LockKeyhole className="text-olive/60 size-[12px]" />
          <span className="font-montserrat text-[10px] text-muted-text/70 font-normal">
            256-bit SSL encrypted checkout
          </span>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <RefreshCw className="text-olive/60 size-[12px]" />
          <span className="font-montserrat text-[10px] text-muted-text/70 font-normal">
            Free returns within 30 days
          </span>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <Leaf className="text-olive/60 size-[12px]" />
          <span className="font-montserrat text-[10px] text-muted-text/70 font-normal">
            Carbon-neutral delivery
          </span>
        </div>
      </div>

      {/* Payment methods */}
      <div className="mt-5 pt-4 border-t border-olive/10">
        <p className="font-montserrat text-[10px] uppercase tracking-wider text-muted-text/50 text-center mb-2">
          We accept
        </p>
        <div className="flex justify-center gap-2 flex-wrap">
          {["UPI", "Cards", "Net Banking", "Wallets"].map((method) => (
            <span
              key={method}
              className="border border-olive/15 rounded-sm px-2 py-1 font-montserrat text-[10px] text-muted-text font-medium"
            >
              {method}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
