"use client";

import Link from "next/link";
import { useWishlistStore } from "@/lib/wishlist-store";
import { EmptyWishlist } from "@/components/wishlist/EmptyWishlist";
import { WishlistItemList } from "@/components/wishlist/WishlistItemList";
import { RelatedProducts } from "@/components/product/RelatedProducts";

export function WishlistPageClient() {
  const { items } = useWishlistStore();

  // use items.length for the count
  const itemCount = items.length;

  return (
    <div className="bg-cornsilk min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-6 pb-20">

        {/* Breadcrumb */}
        <nav className="pb-2 flex items-center font-montserrat text-xs text-muted-text">
          <Link href="/" className="hover:text-olive cursor-pointer transition-colors">
            Home
          </Link>
          <span className="mx-2 text-muted-text/40">›</span>
          <span className="text-forest font-medium">Wishlist</span>
        </nav>

        {/* Header */}
        <h1 className="font-merriweather text-2xl md:text-3xl font-normal text-forest mt-2 mb-1">
          {itemCount === 0
            ? "Your wishlist"
            : `${itemCount} saved item${itemCount !== 1 ? "s" : ""}`}
        </h1>
        <p className="font-montserrat text-xs text-muted-text font-normal mb-0">
          Products you&apos;ve saved for later
        </p>

        {items.length === 0 ? (
          <EmptyWishlist />
        ) : (
          <>
            {/* Max-width container so it doesn't stretch too wide on large screens */}
            <div className="max-w-3xl mt-6">
              <WishlistItemList />
            </div>

            {/* You may also like */}
            <RelatedProducts
              productIds={items.map((i) => i.id).slice(0, 4)}
            />
          </>
        )}
      </div>
    </div>
  );
}
