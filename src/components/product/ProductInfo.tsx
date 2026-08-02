"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Star, Minus, Plus, ShoppingBag, Zap, Truck, RefreshCw, Leaf, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import type { Product } from "@/lib/get-product";

export function ProductInfo({ product }: { product: Product }) {
  const [selectedSize, setSelectedSize] = useState<string>(
    product.availableSizes?.[0] || ""
  );
  const [selectedColor, setSelectedColor] = useState<string>(
    product.colors?.[0]?.name || ""
  );
  const [quantity, setQuantity] = useState(1);
  const { items, addItem } = useCartStore();
  
  // Check if the exact currently selected variant is in the cart
  const currentVariantInCart = items.find(
    (i) => 
      i.id === product.id && 
      i.size === (selectedSize || undefined) && 
      i.color === (selectedColor || undefined)
  );
  
  const isAdded = !!currentVariantInCart;
  const isSoldOut = product.badge === "Sold Out";

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleDecrement = () => setQuantity((q) => Math.max(1, q - 1));
  const handleIncrement = () => setQuantity((q) => q + 1);

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      category: product.category,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.images[0] ?? "",
      size: selectedSize || undefined,
      color: selectedColor || undefined,
      quantity,
    });
  };

  return (
    <div className="flex flex-col">
      {/* Top section */}
      <div className="mb-5">
        <p className="font-montserrat text-xs font-semibold uppercase tracking-widest text-olive mb-2">
          {product.category}
        </p>
        <h1 className="font-merriweather text-2xl sm:text-3xl lg:text-3xl font-medium text-forest leading-tight mb-3">
          {product.name}
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "size-[14px]",
                  star <= Math.round(product.rating)
                    ? "fill-clay text-clay"
                    : "text-muted-text/30"
                )}
              />
            ))}
          </div>
          <span className="font-montserrat text-xs text-muted-text hover:text-olive cursor-pointer underline">
            ({product.reviewCount} reviews)
          </span>
        </div>

        <div className="mt-4 flex items-center">
          {product.originalPrice ? (
            <>
              <span className="font-merriweather text-base text-muted-text line-through mr-2">
                {formatPrice(product.originalPrice)}
              </span>
              <span className="font-merriweather text-3xl font-bold text-forest">
                {formatPrice(product.price)}
              </span>
              <span className="bg-warm text-copper text-xs font-semibold font-montserrat px-2 py-0.5 rounded-sm ml-2">
                Save {formatPrice(product.originalPrice - product.price)}
              </span>
            </>
          ) : (
            <span className="font-merriweather text-3xl font-bold text-forest">
              {formatPrice(product.price)}
            </span>
          )}
        </div>
      </div>

      <hr className="border-t border-olive/10 my-5" />

      {/* Variant selectors */}
      <div className="space-y-6">
        {product.sizes && product.sizes.length > 0 && (
          <div>
            <div className="font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-2">
              Size:
              {selectedSize && (
                <span className="text-muted-text ml-2 font-medium normal-case">
                  {selectedSize}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size) => {
                const isAvailable = product.availableSizes?.includes(size);
                const isSelected = selectedSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      if (isAvailable) {
                        setSelectedSize(size);
                      }
                    }}
                    disabled={!isAvailable || isSoldOut}
                    className={cn(
                      "min-w-[44px] h-10 px-3 border rounded-sm font-montserrat text-sm transition-colors",
                      (!isAvailable || isSoldOut) && "opacity-40 cursor-not-allowed pointer-events-none",
                      !isAvailable && "line-through",
                      isAvailable && !isSelected && !isSoldOut && "border-olive/25 text-forest/75 bg-card hover:border-olive hover:bg-warm cursor-pointer",
                      isSelected && "border-forest bg-forest text-cornsilk cursor-pointer"
                    )}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {product.colors && product.colors.length > 0 && (
          <div>
            <div className="font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-2">
              Color:
              {selectedColor && (
                <span className="text-muted-text ml-2 font-medium normal-case">
                  {selectedColor}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((color) => {
                const isSelected = selectedColor === color.name;
                return (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => {
                        setSelectedColor(color.name);
                      }}
                    disabled={isSoldOut}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      isSoldOut ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                      isSelected
                        ? "border-forest ring-2 ring-forest ring-offset-2 ring-offset-cornsilk"
                        : "border-transparent hover:border-olive/50"
                    )}
                    style={{ backgroundColor: color.hex }}
                    aria-label={`Select color ${color.name}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div className="mt-4">
          <label className="font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-2 block">
            Quantity
          </label>
          <div className="flex items-center border border-olive/25 rounded-sm w-fit bg-card h-10">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={quantity <= 1 || isSoldOut}
              className="w-10 h-full flex items-center justify-center hover:bg-warm transition-colors text-forest disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Minus className="size-[14px]" />
            </button>
            <div className="w-12 h-full text-center font-montserrat text-sm font-medium text-forest border-x border-olive/25 flex items-center justify-center">
              {quantity}
            </div>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={isSoldOut}
              className="w-10 h-full flex items-center justify-center hover:bg-warm transition-colors text-forest disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="size-[14px]" />
            </button>
          </div>
        </div>
      </div>

      {/* CTA buttons */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 fixed sm:static bottom-0 left-0 right-0 p-4 sm:p-0 bg-cornsilk sm:bg-transparent border-t border-olive/15 sm:border-0 z-50 sm:z-auto">
        <Button
          onClick={handleAddToCart}
          disabled={isAdded || isSoldOut}
          className={cn(
            "w-full sm:flex-1 font-montserrat text-xs font-semibold uppercase tracking-wider py-3.5 px-6 rounded-sm h-auto transition-all duration-200",
            (isAdded || isSoldOut)
              ? "bg-olive/80 text-cornsilk cursor-not-allowed"
              : "bg-forest text-cornsilk hover:bg-olive active:scale-[0.98]"
          )}
        >
          {isSoldOut ? (
            "Sold Out"
          ) : isAdded ? (
            <>
              <Check className="mr-2 size-[14px]" />
              Added to Bag
            </>
          ) : (
            <>
              <ShoppingBag className="mr-2 size-[14px]" />
              Add to Bag
            </>
          )}
        </Button>
        {/* Buy Now — desktop full label, mobile icon+label */}
        <Button
          variant="outline"
          disabled={isSoldOut}
          className="w-full sm:w-auto border-olive/30 text-forest/80 hover:border-olive hover:text-forest hover:bg-warm font-montserrat text-xs font-semibold uppercase tracking-wider py-3.5 px-6 rounded-sm h-auto bg-transparent flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="mr-2 size-[14px]" />
          Buy Now
        </Button>
      </div>

      {/* Trust signals */}
      <div className="mt-5 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Truck className="text-olive size-[14px]" />
          <span className="font-montserrat text-xs text-muted-text font-normal">
            Free shipping on orders above ₹999
          </span>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="text-olive size-[14px]" />
          <span className="font-montserrat text-xs text-muted-text font-normal">
            30-day hassle-free returns
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Leaf className="text-olive size-[14px]" />
          <span className="font-montserrat text-xs text-muted-text font-normal">
            1 tree planted with this order
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-olive size-[14px]" />
          <span className="font-montserrat text-xs text-muted-text font-normal">
            Secure checkout · Encrypted payment
          </span>
        </div>
      </div>

      {/* Material tags */}
      {product.tags && product.tags.length > 0 && (
        <div className="mt-5 pt-5 border-t border-olive/10">
          <p className="font-montserrat text-[10px] uppercase tracking-widest text-muted-text mb-2">
            Highlights
          </p>
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-montserrat text-olive border border-olive/30 px-2.5 py-1 rounded-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
