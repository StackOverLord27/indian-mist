"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useWishlistStore, type WishlistItem } from "@/lib/wishlist-store";
import React from "react";

interface ProductGalleryProps {
  images: string[];
  badge?: "New" | "Sale";
  wishlistItem: WishlistItem; // full item shape for toggling
}

const placeholderColors = ["bg-[#d4e2c8]", "bg-[#e9edc9]", "bg-[#faedcd]", "bg-[#fefae0]"];

export function ProductGallery({ images, badge, wishlistItem }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  // Use granular selectors so the component re-renders only when
  // the specific data it cares about changes.
  const toggleItem = useWishlistStore((s) => s.toggleItem);
  const wishlisted = useWishlistStore((s) =>
    s.items.some((i) => i.id === wishlistItem.id)
  );

  // Sync carousel api → activeIndex for dot indicators
  React.useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setActiveIndex(carouselApi.selectedScrollSnap());
    carouselApi.on("select", onSelect);
    return () => { carouselApi.off("select", onSelect); };
  }, [carouselApi]);

  const handleThumbnailClick = (index: number) => {
    setActiveIndex(index);
    carouselApi?.scrollTo(index);
  };

  const WishlistButton = () => (
    <button
      type="button"
      onClick={() => toggleItem(wishlistItem)}
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-full bg-cornsilk/90 backdrop-blur-sm shadow-sm transition-all hover:scale-110 hover:bg-cornsilk"
    >
      <Heart
        className={cn(
          "size-[18px] transition-all duration-200",
          wishlisted ? "fill-copper text-copper" : "text-forest/70"
        )}
      />
    </button>
  );

  const BadgeOverlay = () => {
    if (!badge) return null;
    return (
      <span
        className={cn(
          "absolute left-4 top-4 z-10 px-2.5 py-1 rounded-sm text-[10px] font-montserrat font-semibold uppercase tracking-wider",
          badge === "New" ? "bg-forest text-cornsilk" : "bg-copper text-cornsilk"
        )}
      >
        {badge}
      </span>
    );
  };

  if (!images || images.length === 0) return null;

  return (
    <div className="w-full">
      {/* Desktop Main Image */}
      <div className="hidden lg:block relative w-full aspect-square overflow-hidden rounded-md">
        <div className={cn("absolute inset-0", placeholderColors[activeIndex % placeholderColors.length])} />
        <Image
          src={images[activeIndex]}
          alt={`Product image ${activeIndex + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
        <BadgeOverlay />
        <WishlistButton />
      </div>

      {/* Mobile Swipe Carousel — shadcn Carousel (Embla) */}
      <div className="lg:hidden relative">
        <BadgeOverlay />
        <WishlistButton />
        <Carousel
          setApi={setCarouselApi}
          opts={{ loop: false, align: "start" }}
          className="w-full"
        >
          <CarouselContent className="-ml-0">
            {images.map((img, idx) => (
              <CarouselItem key={idx} className="pl-0">
                <div className="relative w-full aspect-square overflow-hidden">
                  <div className={cn("absolute inset-0", placeholderColors[idx % placeholderColors.length])} />
                  <Image
                    src={img}
                    alt={`Product image ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority={idx === 0}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      {/* Mobile Dot Indicators */}
      {images.length > 1 && (
        <div className="flex lg:hidden justify-center gap-1.5 mt-2">
          {images.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Go to image ${idx + 1}`}
              onClick={() => handleThumbnailClick(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                activeIndex === idx ? "bg-olive w-3" : "bg-olive/30 w-1.5"
              )}
            />
          ))}
        </div>
      )}

      {/* Desktop Thumbnail Strip */}
      {images.length > 1 && (
        <div className="hidden lg:flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => handleThumbnailClick(idx)}
              className={cn(
                "relative w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded-sm overflow-hidden cursor-pointer border-2 transition-colors",
                activeIndex === idx
                  ? "border-olive"
                  : "border-olive/15 hover:border-olive/40"
              )}
            >
              <Image
                src={img}
                alt={`Thumbnail ${idx + 1}`}
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
