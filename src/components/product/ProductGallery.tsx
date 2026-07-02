"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: string[];
  badge?: "New" | "Sale";
}

const placeholderColors = ["bg-[#d4e2c8]", "bg-[#e9edc9]", "bg-[#faedcd]", "bg-[#fefae0]"];

export function ProductGallery({ images, badge }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleThumbnailClick = (index: number) => {
    setActiveIndex(index);
    // If mobile carousel is visible, scroll to it
    if (scrollContainerRef.current) {
      const scrollWidth = scrollContainerRef.current.scrollWidth;
      const itemWidth = scrollWidth / images.length;
      scrollContainerRef.current.scrollTo({
        left: itemWidth * index,
        behavior: "smooth"
      });
    }
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const itemWidth = scrollContainerRef.current.scrollWidth / images.length;
    const newIndex = Math.round(scrollLeft / itemWidth);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < images.length) {
      setActiveIndex(newIndex);
    }
  };

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
      </div>

      {/* Mobile Swipe Carousel */}
      <div className="lg:hidden relative">
        <BadgeOverlay />
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {images.map((img, idx) => (
            <div key={idx} className="relative w-full aspect-square flex-shrink-0 snap-center">
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
          ))}
        </div>
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
        <div className="hidden lg:flex gap-2 mt-3 overflow-x-auto pb-1 hide-scrollbar">
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
