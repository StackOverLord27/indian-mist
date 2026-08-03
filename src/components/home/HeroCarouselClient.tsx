"use client";

import * as React from "react";
import Image from "next/image";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { CarouselImage } from "@/types/admin";

interface HeroCarouselClientProps {
  slides: CarouselImage[];
}

export function HeroCarouselClient({ slides }: HeroCarouselClientProps) {
  const [api, setApi] = React.useState<CarouselApi>();
  const plugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true })
  );

  React.useEffect(() => {
    if (!api) return;

    const handleKeyUp = (e: KeyboardEvent) => {
      // Ignore keyboard events if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === "ArrowLeft") {
        api.scrollPrev();
      } else if (e.key === "ArrowRight") {
        api.scrollNext();
      }
    };

    window.addEventListener("keyup", handleKeyUp);
    return () => window.removeEventListener("keyup", handleKeyUp);
  }, [api]);

  return (
    <div className="w-full relative group">
      <Carousel
        setApi={setApi}
        opts={{
          align: "start",
          loop: true,
        }}
        plugins={[plugin.current]}
        className="w-full"
        onMouseEnter={plugin.current.stop}
        onMouseLeave={plugin.current.reset}
      >
        <CarouselContent className="-ml-0">
          {slides.map((slide, idx) => (
            <CarouselItem key={slide._id} className="pl-0">
              <div className="relative w-full h-[60vh] md:h-[80vh] overflow-hidden">
                {/* Image Background */}
                <Image
                  src={slide.url}
                  alt={slide.altText || "Carousel image"}
                  fill
                  className="object-cover object-center"
                  priority={idx === 0}
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/40" />

                {/* Content - Since the dynamic DB only has images and alt text, 
                    we fallback text to altText or omit it */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  <div className="space-y-4 max-w-3xl animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tight">
                      {slide.altText}
                    </h2>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="hidden md:block">
          <CarouselPrevious className="left-8 bg-background/20 hover:bg-background/40 border-none text-white opacity-0 group-hover:opacity-100 transition-opacity h-12 w-12" />
          <CarouselNext className="right-8 bg-background/20 hover:bg-background/40 border-none text-white opacity-0 group-hover:opacity-100 transition-opacity h-12 w-12" />
        </div>
      </Carousel>
    </div>
  );
}
