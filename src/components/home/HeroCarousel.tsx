import * as React from "react";
import Image from "next/image";
import { CarouselImage } from "@/types/admin";
import { HeroCarouselClient } from "./HeroCarouselClient";

export async function HeroCarousel() {
  let slides: CarouselImage[] = [];

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000'}/api/admin/carousel`, { 
      next: { revalidate: 60 } 
    });
    if (res.ok) {
      const data = await res.json();
      slides = data.images || data;
    }
  } catch (error) {
    console.error("Failed to fetch carousel images:", error);
  }

  // Filter out inactive slides
  let activeSlides = slides.filter(s => s.isActive);

  if (activeSlides.length === 0) {
    // Fallback
    activeSlides = [
      {
        _id: "1",
        url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2000&auto=format&fit=crop",
        altText: "Embrace the Forest",
        publicId: "",
        order: 1,
        isActive: true
      },
      {
        _id: "2",
        url: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2000&auto=format&fit=crop",
        altText: "Sustainable Living",
        publicId: "",
        order: 2,
        isActive: true
      }
    ];
  }

  return <HeroCarouselClient slides={activeSlides} />;
}
