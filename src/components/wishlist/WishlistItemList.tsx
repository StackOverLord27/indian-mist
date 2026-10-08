"use client";

import { getImageSrc } from "@/lib/utils";
import toast from "react-hot-toast";
import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlistStore, type WishlistItem } from "@/lib/wishlist-store";
import { useCartStore } from "@/lib/cart-store";
import { useState } from "react";

const placeholderColors = [
  "bg-[#d4e2c8]",
  "bg-[#e9edc9]",
  "bg-[#faedcd]",
  "bg-[#fefae0]",
];

function WishlistItemCard({
  item,
  index,
}: {
  item: WishlistItem;
  index: number;
}) {
  const { removeItem } = useWishlistStore();
  const { addItem, items: cartItems } = useCartStore();
  const [removing, setRemoving] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const inCart = cartItems.some((i) => i.id === item.id);
  const placeholder = placeholderColors[index % placeholderColors.length];
  const isSoldOut = item.badge === "Sold Out";

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  const handleRemove = () => {
    setRemoving(true);
    setTimeout(() => removeItem(item.id), 200);
  };

  const handleAddToCart = () => {
    addItem({
      id: item.id,
      slug: item.slug,
      name: item.name,
      category: item.category,
      price: item.price,
      originalPrice: item.originalPrice,
      image: item.image,
      quantity: 1,
    });
    setAddedToCart(true);
    toast.success(`${item.name} added to bag`);
  };

  return (
    <div
      className={cn(
        "bg-card border border-olive/10 rounded-md p-4 flex gap-4 items-start hover:border-olive/20 transition-all duration-200",
        removing && "opacity-0 -translate-x-2",
      )}
    >
      {/* Image */}
      <Link href={`/products/${item.slug}`} className="flex-shrink-0">
        <div
          className={cn(
            "w-20 h-20 md:w-24 md:h-24 relative rounded-sm overflow-hidden",
            placeholder,
            isSoldOut && "opacity-60 grayscale",
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
                sizes="96px"
              />
            ) : null;
          })()}
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <p className="font-montserrat text-[10px] uppercase tracking-wider text-olive mb-0.5">
              {item.category}
            </p>
            <Link href={`/products/${item.slug}`}>
              <h3 className="font-merriweather text-sm md:text-base font-normal text-forest leading-snug mb-1 hover:underline">
                {item.name}
              </h3>
            </Link>
            <div className="flex items-center gap-2 mt-1">
              {item.originalPrice && (
                <span className="font-montserrat text-xs text-muted-text line-through">
                  {formatPrice(item.originalPrice)}
                </span>
              )}
              <span className="font-merriweather text-base font-bold text-forest">
                {formatPrice(item.price)}
              </span>
              {item.badge && (
                <span
                  className={cn(
                    "font-montserrat text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm",
                    item.badge === "Sold Out"
                      ? "bg-muted-text/80 text-cornsilk"
                      : item.badge === "Sale"
                        ? "bg-warm text-copper"
                        : "bg-forest/10 text-forest",
                  )}
                >
                  {item.badge}
                </span>
              )}
            </div>
          </div>

          {/* Remove */}
          <button
            type="button"
            onClick={handleRemove}
            aria-label={`Remove ${item.name} from wishlist`}
            className="text-muted-text hover:text-copper transition-colors flex-shrink-0 p-0.5 min-h-[44px] min-w-[44px] flex items-start justify-end"
          >
            <X className="size-[14px]" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={inCart || addedToCart || isSoldOut}
            className={cn(
              "flex items-center gap-1.5 font-montserrat text-xs font-semibold uppercase tracking-wider px-4 py-2.5 rounded-sm transition-all min-h-[44px]",
              inCart || addedToCart || isSoldOut
                ? "bg-olive/80 text-cornsilk cursor-not-allowed"
                : "bg-forest text-cornsilk hover:bg-olive active:scale-[0.98]",
            )}
          >
            {isSoldOut ? (
              "Sold Out"
            ) : (
              <>
                <ShoppingBag className="size-[12px]" />
                {inCart || addedToCart ? "In Bag" : "Add to Bag"}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleRemove}
            className="flex items-center gap-1.5 font-montserrat text-xs font-semibold uppercase tracking-wider px-4 py-2.5 rounded-sm border border-olive/20 text-forest/80 hover:border-olive hover:text-forest hover:bg-warm transition-all min-h-[44px]"
          >
            <Heart className="size-[12px]" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export function WishlistItemList() {
  const { items } = useWishlistStore();

  return (
    <div className="space-y-3 md:space-y-4">
      {items.map((item, index) => (
        <WishlistItemCard key={item.id} item={item} index={index} />
      ))}
    </div>
  );
}
