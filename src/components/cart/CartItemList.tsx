"use client";

import Link from "next/link";
import { ArrowLeft, Tag } from "lucide-react";
import { CartItemCard } from "@/components/cart/CartItemCard";
import { useCartStore } from "@/lib/cart-store";

export function CartItemList() {
  const { items } = useCartStore();

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
        <ArrowLeft className="size-3.25" />
        Continue Shopping
      </Link>

      {/* Promo hint */}
      <div className="mt-6 pt-6 border-t border-olive/10">
        <div className="flex items-center gap-2 text-olive/80">
          <Tag className="size-3.5" />
          <span className="font-montserrat text-xs text-olive/80">
            Have a promo code? You can apply it at checkout.
          </span>
        </div>
      </div>
    </div>
  );
}

