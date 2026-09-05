"use client";

import * as React from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { CarouselImage } from "@/types/admin";

interface HeroCarouselClientProps {
  slides: CarouselImage[];
  className?: string;
  itemClassName?: string;
  showOverlayText?: boolean;
}

export function HeroCarouselClient({
  slides,
  className = "w-full h-full relative group",
  itemClassName = "relative w-full h-full min-h-[min(75vw,30rem)] lg:min-h-120 overflow-hidden",
  showOverlayText = false,
}: HeroCarouselClientProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [canScrollPrev, setCanScrollPrev] = React.useState(true);
  const [canScrollNext, setCanScrollNext] = React.useState(true);

  // Auto-rotate with 5s interval
  React.useEffect(() => {
    if (!emblaApi) return;
    if (slides.length <= 1) return;

    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 5000);

    return () => clearInterval(interval);
  }, [emblaApi, slides.length]);

  // Update scroll state on select
  React.useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };

    emblaApi.on("select", onSelect);
    onSelect();

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!emblaApi) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        emblaApi.scrollPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        emblaApi.scrollNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [emblaApi]);

  if (!slides || slides.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="w-full h-full relative overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {slides.map((slide, idx) => (
            <div
              key={slide._id || `slide-${idx}`}
              className="flex-[0_0_100%] min-w-0 h-full"
            >
              <div className={itemClassName}>
                <Image
                  src={slide.url}
                  alt={slide.alt || slide.altText || "Carousel image"}
                  fill
                  className="object-cover object-center select-none pointer-events-none"
                  priority={idx === 0}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  draggable={false}
                />

                {showOverlayText && (
                  <>
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                      <div className="space-y-4 max-w-3xl animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tight">
                          {slide.alt || slide.altText}
                        </h2>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation arrows */}
      {slides.length > 1 && (
        <div className="hidden md:block">
          <button
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canScrollPrev}
            aria-label="Previous slide"
            className="absolute top-1/2 left-4 -translate-y-1/2 flex items-center justify-center h-9 w-9 rounded-full bg-black-forest/40 hover:bg-black-forest/70 border-none text-cornsilk opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <button
            onClick={() => emblaApi?.scrollNext()}
            disabled={!canScrollNext}
            aria-label="Next slide"
            className="absolute top-1/2 right-4 -translate-y-1/2 flex items-center justify-center h-9 w-9 rounded-full bg-black-forest/40 hover:bg-black-forest/70 border-none text-cornsilk opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
