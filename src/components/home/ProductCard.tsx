"use client";

import { useState, useRef, useEffect } from "react";
import { Heart, Plus, Check, X } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { ImageSlot } from "@/components/home/ImageSlot";
import { useCartStore } from "@/lib/cart-store";
import { useWishlistStore } from "@/lib/wishlist-store";
import type { Product } from "@/lib/homepage-data";

export function ProductCard({ product, hideNewBadge = false }: { product: Product; hideNewBadge?: boolean }) {
  const [sizePickerOpen, setSizePickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const toggleItem = useWishlistStore((s) => s.toggleItem);
  const wishlisted = useWishlistStore((s) =>
    s.items.some((i) => i.id === product.id)
  );
  const addCartItem = useCartStore((s) => s.addItem);

  // Close picker on outside click
  useEffect(() => {
    if (!sizePickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setSizePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sizePickerOpen]);

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.success(wishlisted ? "Removed from wishlist" : "Added to wishlist");
    toggleItem({
      id: product.id,
      slug: product.id,
      name: product.name,
      category: product.category,
      price: parseFloat(product.price.replace(/[^\d.]/g, "")),
      badge: product.badge,
      image: product.image.src ?? "",
    });
  };

  const addToCartWithSize = (size?: string) => {
    addCartItem({
      id: product.id,
      slug: product.id,
      name: product.name,
      category: product.category,
      price: parseFloat(product.price.replace(/[^\d.]/g, "")),
      image: product.image.src ?? "",
      size,
      quantity: 1,
    });
    setSizePickerOpen(false);
    toast.success(`${product.name} added to bag`);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (product.sizes && product.sizes.length > 0) {
      setSizePickerOpen(true);
      return;
    }
    addToCartWithSize(undefined);
  };

  const hasSizes = product.sizes && product.sizes.length > 0;
  const inCart = useCartStore((s) => {
    const matching = s.items.filter((i) => i.id === product.id);
    if (!hasSizes) return matching.length > 0;
    return product.sizes!.every((size) => matching.some((i) => i.size === size));
  });
  const isSoldOut = product.badge === "Sold Out";

  return (
    <article className={cn("group relative overflow-hidden rounded-home-card border border-olive-leaf/10 bg-card-bg p-0 transition-transform hover:-translate-y-1 hover:shadow-sm sm:overflow-visible sm:p-3", isSoldOut && "opacity-75")}>
      <Link href={`/products/${product.id}`} className={cn("block relative aspect-square overflow-hidden rounded-none sm:rounded-home-card", isSoldOut && "opacity-60 grayscale")}>
        <ImageSlot
          image={product.image}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
        />
        {product.badge && !(hideNewBadge && product.badge === "New") ? (
          <span
            className={
              product.badge === "Sale"
                ? "absolute left-2 top-2 sm:left-3 sm:top-3 rounded-full bg-copperwood px-2.5 sm:px-3 py-1 font-sans text-3xs font-medium uppercase tracking-widest text-cornsilk"
                : product.badge === "Sold Out"
                ? "absolute left-2 top-2 sm:left-3 sm:top-3 rounded-full bg-muted-text/80 px-2.5 sm:px-3 py-1 font-sans text-3xs font-medium uppercase tracking-widest text-cornsilk"
                : "absolute left-2 top-2 sm:left-3 sm:top-3 rounded-full bg-black-forest px-2.5 sm:px-3 py-1 font-sans text-3xs font-medium uppercase tracking-widest text-cornsilk"
            }
          >
            {product.badge}
          </span>
        ) : null}
      </Link>

      <button
        type="button"
        onClick={handleWishlist}
        aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
        className="absolute right-2 top-2 sm:right-5 sm:top-5 flex size-8 items-center justify-center rounded-full bg-cornsilk transition-all hover:scale-110 z-10"
      >
        <Heart
          className={cn(
            "size-4 transition-colors",
            wishlisted ? "fill-copper text-copper" : "text-black-forest"
          )}
          aria-hidden="true"
        />
      </button>

      <div className="px-3 pb-3 pt-3 sm:px-1 sm:pb-1 sm:pt-4">
        <p className="font-sans text-2xs font-medium uppercase tracking-widest text-olive-leaf">
          {product.category}
        </p>
        <Link href={`/products/${product.id}`}>
          <h3 className="mt-1.5 line-clamp-2 font-serif text-sm font-normal text-black-forest hover:underline sm:mt-2">
            {product.name}
          </h3>
        </Link>
        <div className="mt-3 flex items-center justify-between gap-2 sm:mt-4 sm:gap-4">
          <p className="font-sans text-sm font-medium text-black-forest">
            {product.price}
          </p>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isSoldOut || inCart}
            className={cn(
              "flex size-9 items-center justify-center rounded-full transition-opacity",
              (isSoldOut || inCart)
                ? "bg-muted-text/30 text-cornsilk cursor-not-allowed"
                : "bg-olive-leaf text-cornsilk hover:opacity-85"
            )}
            aria-label={inCart ? `Added ${product.name} to bag` : `Add ${product.name} to bag`}
          >
            {inCart ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Size picker */}
        {sizePickerOpen && product.sizes && (
          <div
            ref={pickerRef}
            className="mt-3 rounded-lg border border-olive-leaf/15 bg-cornsilk p-3 shadow-md animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-montserrat text-[10px] font-semibold uppercase tracking-widest text-forest">
                Select size
              </p>
              <button
                type="button"
                onClick={() => setSizePickerOpen(false)}
                className="flex size-5 items-center justify-center rounded-full text-muted-text hover:text-forest transition-colors"
                aria-label="Close size picker"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {product.sizes.map((size) => {
                const sizeInCart = useCartStore.getState().items.some(
                  (i) => i.id === product.id && i.size === size
                );
                return (
                  <button
                    key={size}
                    type="button"
                    disabled={sizeInCart}
                    onClick={() => addToCartWithSize(size)}
                    className={cn(
                      "min-w-9 rounded-sm border px-2 py-1.5 font-montserrat text-xs font-medium transition-colors",
                      sizeInCart
                        ? "border-olive/20 bg-olive/10 text-muted-text cursor-not-allowed"
                        : "border-olive-leaf/25 text-forest hover:border-forest hover:bg-forest hover:text-cornsilk"
                    )}
                  >
                    {sizeInCart ? <Check className="mx-auto size-3" /> : size}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
