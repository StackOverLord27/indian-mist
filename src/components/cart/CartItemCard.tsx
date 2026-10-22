"use client";

import { getImageSrc } from "@/lib/utils";
import { useState, useRef } from "react";
import Image from "next/image";
import { Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore, type CartItem } from "@/lib/cart-store";

const placeholderColors = [
  "bg-[#d4e2c8]",
  "bg-[#e9edc9]",
  "bg-[#faedcd]",
  "bg-[#fefae0]",
];

export function CartItemCard({
  item,
  index,
}: {
  item: CartItem;
  index: number;
}) {
  const { removeItem, updateQuantity } = useCartStore();
  const [removing, setRemoving] = useState(false);
  const [priceFlash, setPriceFlash] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  const handleRemove = () => {
    setRemoving(true);
    setTimeout(() => {
      removeItem(item.id, item.size);
    }, 200);
  };

  const handleQuantity = (delta: number) => {
    const next = item.quantity + delta;
    if (next < 1) {
      handleRemove();
      return;
    }
    updateQuantity(item.id, next, item.size);
    // Pulse animation on price
    setPriceFlash(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setPriceFlash(false), 150);
  };

  const placeholder = placeholderColors[index % placeholderColors.length];

  return (
    <div
      className={cn(
        "bg-card border border-olive/10 rounded-md p-4 flex gap-4 items-start hover:border-olive/20 transition-all duration-200",
        removing && "opacity-0 -translate-x-2",
      )}
    >
      {/* Image */}
      <div
        className={cn(
          "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 flex-shrink-0 relative rounded-sm overflow-hidden",
          placeholder,
        )}
      >
        {(() => {
          const imgSrc = getImageSrc(item.image);
          return imgSrc ? (
            <Image
              src={imgSrc}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 64px, 96px"
            />
          ) : null;
        })()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Top row: category + remove */}
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <p className="font-montserrat text-[10px] uppercase tracking-wider text-olive mb-0.5">
              {item.category}
            </p>
            <h3 className="font-merriweather text-sm md:text-base font-normal text-forest leading-snug mb-1">
              {item.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            aria-label={`Remove ${item.name}`}
            className="text-muted-text hover:text-copper transition-colors ml-2 flex-shrink-0 p-0.5 mt-0.5 min-h-[44px] min-w-[44px] flex items-start justify-end"
          >
            <X className="size-[14px]" />
          </button>
        </div>

        {/* Variant row */}
        {(item.size || item.color) && (
          <div className="flex gap-3 font-montserrat text-xs text-muted-text mb-1">
            {item.size && <span>Size: {item.size}</span>}
            {item.size && item.color && (
              <span className="text-muted-text/30">·</span>
            )}
            {item.color && <span>Color: {item.color}</span>}
          </div>
        )}

        {/* Bottom row: stepper + price */}
        <div className="flex items-center justify-between mt-3">
          {/* Quantity stepper */}
          <div className="flex items-center border border-olive/20 rounded-sm bg-cornsilk w-fit">
            <button
              type="button"
              onClick={() => handleQuantity(-1)}
              aria-label="Decrease quantity"
              className="w-8 h-8 flex items-center justify-center hover:bg-warm text-forest transition-colors"
            >
              <Minus className="size-[12px]" />
            </button>
            <div className="w-10 h-8 text-center font-montserrat text-sm text-forest border-x border-olive/20 flex items-center justify-center">
              {item.quantity}
            </div>
            <button
              type="button"
              onClick={() => handleQuantity(1)}
              disabled={item.maxQuantity !== undefined && item.quantity >= item.maxQuantity}
              aria-label="Increase quantity"
              className="w-8 h-8 flex items-center justify-center hover:bg-warm text-forest transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="size-[12px]" />
            </button>
          </div>

          {/* Price */}
          <div className="text-right">
            {item.originalPrice && (
              <span className="font-montserrat text-xs text-muted-text line-through block">
                {formatPrice(item.originalPrice * item.quantity)}
              </span>
            )}
            <span
              className={cn(
                "font-merriweather text-base font-bold text-forest inline-block transition-transform duration-100",
                priceFlash && "scale-105",
              )}
            >
              {formatPrice(item.price * item.quantity)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
