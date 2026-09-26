"use client";

import Image from "next/image";
import {
  LockKeyhole,
  Leaf,
  RefreshCw,
  ShieldCheck,
  Package,
  Loader2,
  Tag,
  Sparkles,
  Gift,
  X,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { GST_RATE } from "@/lib/constants";

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
  size?: string;
  color?: string;
}

interface CouponState {
  code: string;
  applied: boolean;
  discount: number;
  loading: boolean;
}

interface CheckoutOrderSummaryProps {
  items: CartItem[];
  subtotal: number;
  shippingFree: boolean;
  shippingCost: number;
  discountedSubtotal: number;
  taxAmount: number;
  totalAmount: number;
  coupon: CouponState;
  onCouponCodeChange: (code: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  isLoading: boolean;
  payBtnRef: React.RefObject<HTMLButtonElement | null>;
}

export function CheckoutOrderSummary({
  items,
  subtotal,
  shippingFree,
  shippingCost,
  discountedSubtotal,
  taxAmount,
  totalAmount,
  coupon,
  onCouponCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  isLoading,
  payBtnRef,
}: CheckoutOrderSummaryProps) {
  return (
    <div className="lg:sticky lg:top-20 self-start space-y-5">
      {/* Order items card */}
      <div className="bg-card border border-olive/10 rounded-md p-5 md:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Package className="size-4 text-olive" />
          <h2 className="font-merriweather text-lg font-normal text-forest">
            Order Summary
          </h2>
        </div>

        {/* Item list */}
        <div className="space-y-3 pb-5 border-b border-olive/10 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="flex gap-3 group"
            >
              <div className="w-14 h-14 flex-shrink-0 rounded-sm overflow-hidden bg-olive/10 relative">
                {(() => {
                  const imgSrc = typeof item.image === 'string' ? item.image : (item.image as any)?.url;
                  return imgSrc ? (
                    <Image
                      src={imgSrc}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-olive/30 text-xs font-montserrat">
                      IM
                    </div>
                  );
                })()}
                {/* Quantity badge */}
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-forest text-cornsilk rounded-full flex items-center justify-center font-montserrat text-[9px] font-bold">
                  {item.quantity}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-montserrat text-xs text-forest font-medium truncate leading-tight">
                  {item.name}
                </p>
                <p className="font-montserrat text-[10px] text-muted-text mt-0.5">
                  {item.size ? `${item.size}` : ""}
                  {item.size && item.color ? " · " : ""}
                  {item.color ? `${item.color}` : ""}
                </p>
              </div>
              <p className="font-montserrat text-xs text-forest font-semibold whitespace-nowrap">
                {formatPrice(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        {/* Coupon Code Section */}
        <div className="py-4 border-b border-olive/10">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="size-3.5 text-olive" />
            <span className="font-montserrat text-xs font-semibold text-forest uppercase tracking-wider">
              Coupon Code
            </span>
          </div>

          {coupon.applied ? (
            <div className="flex items-center justify-between bg-olive/5 border border-olive/15 rounded-sm px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Gift className="size-3.5 text-olive" />
                <span className="font-montserrat text-xs font-semibold text-olive uppercase">
                  {coupon.code}
                </span>
                <span className="font-montserrat text-[10px] text-olive">
                  (−{formatPrice(coupon.discount)})
                </span>
              </div>
              <button
                type="button"
                onClick={onRemoveCoupon}
                className="text-muted-text/50 hover:text-copper transition-colors p-0.5"
                aria-label="Remove coupon"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={coupon.code}
                onChange={(e) => onCouponCodeChange(e.target.value.toUpperCase())}
                placeholder="Enter code"
                className="flex-1 font-montserrat text-xs text-forest bg-transparent border border-olive/15 rounded-sm px-3 py-2.5 focus:border-olive outline-none placeholder:text-forest/20 uppercase tracking-wider"
              />
              <button
                type="button"
                onClick={onApplyCoupon}
                disabled={coupon.loading}
                className="bg-forest/10 hover:bg-forest/15 text-forest font-montserrat text-[10px] font-semibold uppercase tracking-wider px-4 py-2.5 rounded-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {coupon.loading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  "Apply"
                )}
              </button>
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="space-y-3 py-4 border-b border-olive/10">
          <div className="flex justify-between items-center">
            <span className="font-montserrat text-sm text-muted-text">
              Subtotal
            </span>
            <span className="font-montserrat text-sm text-forest font-medium">
              {formatPrice(subtotal)}
            </span>
          </div>

          {coupon.applied && coupon.discount > 0 && (
            <div className="flex justify-between items-center">
              <span className="font-montserrat text-sm text-olive flex items-center gap-1.5">
                <Sparkles className="size-3" />
                Discount
              </span>
              <span className="font-montserrat text-sm text-olive font-medium">
                −{formatPrice(coupon.discount)}
              </span>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center">
              <span className="font-montserrat text-sm text-muted-text">
                Shipping
              </span>
              <span
                className={`font-montserrat text-sm font-medium ${
                  shippingFree ? "text-olive" : "text-forest"
                }`}
              >
                {shippingFree ? "Free" : formatPrice(shippingCost)}
              </span>
            </div>
            {shippingFree && (
              <p className="text-[10px] text-olive font-montserrat mt-0.5">
                ✓ Free shipping unlocked
              </p>
            )}
          </div>

          <div className="flex justify-between items-center">
            <span className="font-montserrat text-sm text-muted-text">
              GST (18%)
            </span>
            <span className="font-montserrat text-sm text-forest font-medium">
              {formatPrice(taxAmount)}
            </span>
          </div>
        </div>

        {/* Total */}
        <div className="pt-4 flex justify-between items-baseline mb-6">
          <span className="font-montserrat text-sm font-semibold text-forest uppercase tracking-wide">
            Total
          </span>
          <div className="text-right">
            {coupon.applied && coupon.discount > 0 && (
              <span className="font-montserrat text-xs text-muted-text line-through block mb-0.5">
                {formatPrice(subtotal + shippingCost + Math.round((subtotal + shippingCost) * GST_RATE))}
              </span>
            )}
            <span className="font-merriweather text-2xl font-bold text-forest">
              {formatPrice(totalAmount)}
            </span>
          </div>
        </div>

        {/* Pay button */}
        <button
          ref={payBtnRef}
          type="submit"
          disabled={isLoading}
          id="checkout-pay-button"
          className="w-full bg-forest text-cornsilk hover:bg-olive font-montserrat text-xs font-semibold uppercase tracking-wider py-4 rounded-sm h-auto transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-forest/15 active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <LockKeyhole className="size-4" />
              Pay Securely — {formatPrice(totalAmount)}
            </>
          )}
        </button>

        {/* Trust signals */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-center gap-1.5">
            <LockKeyhole className="text-olive/60 size-3" />
            <span className="font-montserrat text-[10px] text-muted-text/70">
              Secured by Razorpay · 256-bit SSL encryption
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="text-olive/60 size-3" />
            <span className="font-montserrat text-[10px] text-muted-text/70">
              PCI DSS compliant payment processing
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <RefreshCw className="text-olive/60 size-3" />
            <span className="font-montserrat text-[10px] text-muted-text/70">
              Free returns within 30 days
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <Leaf className="text-olive/60 size-3" />
            <span className="font-montserrat text-[10px] text-muted-text/70">
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
            {["UPI", "Cards", "Net Banking", "Wallets"].map(
              (method) => (
                <span
                  key={method}
                  className="border border-olive/15 rounded-sm px-2.5 py-1 font-montserrat text-[10px] text-muted-text font-medium hover:border-olive/30 transition-colors"
                >
                  {method}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
