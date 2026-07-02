"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { CartItemCard } from "@/components/cart/CartItemCard";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";

export function CartItemList() {
  const { items } = useCartStore();
  const [promoCode, setPromoCode] = useState("");

  return (
    <div>
      {/* Items */}
      <div className="space-y-3 md:space-y-4">
        {items.map((item, index) => (
          <CartItemCard
            key={`${item.id}-${item.size ?? ""}-${item.color ?? ""}`}
            item={item}
            index={index}
          />
        ))}
      </div>

      {/* Continue Shopping */}
      <Link
        href="/products"
        className="mt-6 inline-flex items-center gap-1.5 text-olive font-montserrat text-xs font-semibold uppercase tracking-wider hover:text-copper transition-colors"
      >
        <ArrowLeft className="size-[13px]" />
        Continue Shopping
      </Link>

      {/* Promo code */}
      <div className="mt-6 pt-6 border-t border-olive/10">
        <label className="font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-2 block">
          Promo Code
        </label>
        <div className="flex gap-0">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Enter promo code"
            className="flex-1 px-4 py-2.5 bg-cornsilk border border-olive/25 rounded-l-sm border-r-0 font-montserrat text-sm text-forest outline-none focus:border-olive transition-colors placeholder:text-muted-text/60"
          />
          <Button
            onClick={() => {/* wire promo logic */}}
            className="bg-forest text-cornsilk px-5 py-2.5 font-montserrat text-xs font-semibold uppercase tracking-wider rounded-r-sm rounded-l-none hover:bg-olive transition-colors h-auto"
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
