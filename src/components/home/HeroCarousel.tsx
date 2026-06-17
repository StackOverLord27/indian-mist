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

const slides = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2000&auto=format&fit=crop",
    title: "Embrace the Forest",
    description: "Discover our new range of eco-friendly outdoor gear.",
    cta: "Shop Now"
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2000&auto=format&fit=crop",
    title: "Sustainable Living",
    description: "Products designed with nature in mind.",
    cta: "Explore Collection"
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=2000&auto=format&fit=crop",
    title: "Adventure Awaits",
    description: "Gear up for your next eco-conscious journey.",
    cta: "View Offers"
  }
];

export function HeroCarousel() {
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
          {slides.map((slide) => (
            <CarouselItem key={slide.id} className="pl-0">
              <div className="relative w-full h-[60vh] md:h-[80vh] overflow-hidden">
                {/* Image Background */}
                <Image
                  src={slide.image}
                  alt={slide.title}
                  fill
                  className="object-cover object-center"
                  priority={slide.id === 1}
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/40" />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  <div className="space-y-4 max-w-3xl animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tight">
                      {slide.title}
                    </h2>
                    <p className="text-lg md:text-2xl text-gray-200">
                      {slide.description}
                    </p>
                    <div className="pt-6">
                      <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-8 py-6 rounded-full transition-transform hover:scale-105 duration-300">
                        {slide.cta}
                      </Button>
                    </div>
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
