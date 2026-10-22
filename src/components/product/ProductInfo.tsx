"use client";

import toast from "react-hot-toast";
import { useState } from "react";
import { Check } from "lucide-react";
import {
  Minus,
  Plus,
  ShoppingBag,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Product } from "@/lib/get-product";
import { SizeChartModal } from "@/components/product/SizeChartModal";

export function ProductInfo({ product, sizeChartUrl }: { product: Product; sizeChartUrl?: string }) {
  const router = useRouter();
  const [selectedSize, setSelectedSize] = useState<string>(
    product.availableSizes?.[0] || "",
  );
  // Each colour is its own product, so the colour is simply this product's colour
  const selectedColor = product.color?.name ?? "";
  const [quantity, setQuantity] = useState(1);
  const { items, addItem, setBuyNowItem } = useCartStore();
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  // Check if the exact currently selected variant is in the cart
  const currentVariantInCart = items.find(
    (i) =>
      i.id === product.id &&
      i.size === (selectedSize || undefined),
  );

  const isAdded = !!currentVariantInCart;
  const isSoldOut =
    product.badge === "Sold Out" ||
    (!!product.stockBySize && !product.availableSizes?.length) ||
    product.stock === 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleDecrement = () => setQuantity((q) => Math.max(1, q - 1));
  // Units the shopper can still add: the chosen size's stock, or the product's, when tracked
  const maxQty = product.stockBySize ? (product.stockBySize[selectedSize] ?? 0) : product.stock;
  const handleIncrement = () => setQuantity((q) => (maxQty === undefined ? q + 1 : Math.min(q + 1, Math.max(maxQty, 1))));

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      category: product.category,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.images[0] || "",
      size: selectedSize || undefined,
      color: selectedColor || undefined,
      quantity,
      maxQuantity: maxQty,
    });
    toast.success(`${product.name} added to bag`);
  };

  const productItemForCheckout = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    price: product.price,
    originalPrice: product.originalPrice,
    image: product.images[0] || "",
    size: selectedSize || undefined,
    color: selectedColor || undefined,
    quantity,
    maxQuantity: maxQty,
  };

  const handleBuyNowClick = () => {
    if (items.length > 0) {
      setShowMergeDialog(true);
    } else {
      setBuyNowItem(productItemForCheckout);
      router.push("/checkout");
    }
  };

  const handleMergeYes = () => {
    addItem(productItemForCheckout);
    setBuyNowItem(null); // use full cart
    setShowMergeDialog(false);
    router.push("/checkout");
  };

  const handleMergeNo = () => {
    setBuyNowItem(productItemForCheckout); // checkout only this item
    setShowMergeDialog(false);
    router.push("/checkout");
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
            <div className="flex items-center justify-between mb-2">
              <div className="font-montserrat text-xs font-semibold uppercase tracking-wider text-forest">
                Size:
                {selectedSize && (
                  <span className="text-muted-text ml-2 font-medium normal-case">
                    {selectedSize}
                  </span>
                )}
              </div>
              {sizeChartUrl && <SizeChartModal url={sizeChartUrl} />}
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
                        setQuantity(1);
                      }
                    }}
                    disabled={!isAvailable || isSoldOut}
                    className={cn(
                      "min-w-11 h-10 px-3 border rounded-sm font-montserrat text-sm transition-colors",
                      (!isAvailable || isSoldOut) &&
                        "opacity-40 cursor-not-allowed pointer-events-none",
                      !isAvailable && "line-through",
                      isAvailable &&
                        !isSelected &&
                        !isSoldOut &&
                        "border-olive/25 text-forest/85 bg-card hover:border-olive hover:bg-warm cursor-pointer",
                      isSelected &&
                        "border-forest bg-forest text-cornsilk cursor-pointer",
                    )}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {product.color && product.colorVariants.length > 1 && (
          <div>
            <div className="font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-2">
              Color:
              <span className="text-muted-text ml-2 font-medium normal-case">
                {product.color.name}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {product.colorVariants.map((variant) => {
                const isSelected = variant.slug === product.slug;
                return (
                  <Link
                    key={variant.slug}
                    href={`/products/${variant.slug}`}
                    scroll={false}
                    title={variant.soldOut ? `${variant.name} (sold out)` : variant.name}
                    aria-label={`View ${variant.name}`}
                    aria-current={isSelected ? "page" : undefined}
                    className={cn(
                      "relative size-8 rounded-full border transition-all overflow-hidden",
                      isSelected
                        ? "border-forest ring-2 ring-forest ring-offset-2 ring-offset-cornsilk"
                        : "border-olive/30 hover:border-forest",
                      variant.soldOut && "opacity-50",
                    )}
                    style={{ backgroundColor: variant.hex }}
                  >
                    {variant.soldOut && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="block h-px w-full rotate-45 bg-forest/70" />
                      </span>
                    )}
                  </Link>
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
              <Minus className="size-3.5" />
            </button>
            <div className="w-12 h-full text-center font-montserrat text-sm font-medium text-forest border-x border-olive/25 flex items-center justify-center">
              {quantity}
            </div>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={isSoldOut || (maxQty !== undefined && quantity >= maxQty)}
              className="w-10 h-full flex items-center justify-center hover:bg-warm transition-colors text-forest disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          {maxQty !== undefined && maxQty > 0 && maxQty <= 5 && (
            <p className="mt-2 font-montserrat text-xs text-copper">Only {maxQty} left</p>
          )}
        </div>
      </div>

      {/* CTA buttons */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 fixed sm:static bottom-0 left-0 right-0 p-4 sm:p-0 bg-cornsilk/90 backdrop-blur-md sm:bg-transparent sm:backdrop-blur-none border-t border-olive/15 sm:border-0 z-50 sm:z-auto shadow-[0_-2px_10px_rgba(0,0,0,0.06)] sm:shadow-none">
        <Button
          onClick={handleAddToCart}
          disabled={isAdded || isSoldOut}
          className={cn(
            "w-full sm:flex-1 font-montserrat text-xs font-semibold uppercase tracking-wider py-3.5 px-6 rounded-sm h-auto transition-all duration-200",
            isAdded || isSoldOut
              ? "bg-olive/80 text-cornsilk cursor-not-allowed"
              : "bg-forest text-cornsilk hover:bg-olive active:scale-[0.98]",
          )}
        >
          {isSoldOut ? (
            "Sold Out"
          ) : isAdded ? (
            <>
              <Check className="mr-2 size-3.5" />
              Added to Bag
            </>
          ) : (
            <>
              <ShoppingBag className="mr-2 size-3.5" />
              Add to Bag
            </>
          )}
        </Button>
        {/* Buy Now — desktop full label, mobile icon+label */}
        <button
          type="button"
          disabled={isSoldOut}
          onClick={handleBuyNowClick}
          className="w-full sm:w-auto border border-olive-leaf/40 text-forest bg-olive-leaf/10 hover:bg-olive-leaf/20 hover:border-olive-leaf/60 font-montserrat text-xs font-semibold uppercase tracking-wider py-3.5 px-6 rounded-sm h-auto flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Zap className="mr-2 size-3.5" />
          Buy Now
        </button>
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

      <AlertDialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <AlertDialogContent className="bg-cornsilk border-olive/20 max-w-md w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-merriweather text-forest">
              You have items in your bag
            </AlertDialogTitle>
            <AlertDialogDescription className="font-montserrat text-muted-text">
              You already have {items.length} item
              {items.length !== 1 ? "s" : ""} in your bag. Would you like to buy
              them together with this item?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <AlertDialogCancel
              onClick={handleMergeNo}
              className="border-olive/30 text-forest hover:bg-olive/10 mt-0"
            >
              No, only buy this
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMergeYes}
              className="bg-forest text-cornsilk hover:bg-olive"
            >
              Yes, buy together
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
