import * as React from "react";
import dbConnect from "@/lib/db";
import CarouselModel from "@/models/carousel.model";
import { CarouselImage } from "@/types/admin";
import { HeroCarouselClient } from "./HeroCarouselClient";

export async function HeroCarousel({ 
  className,
  itemClassName,
  showOverlayText
}: { 
  className?: string; 
  itemClassName?: string;
  showOverlayText?: boolean;
} = {}) {
  let activeSlides: CarouselImage[] = [];

  try {
    await dbConnect();
    const docs = await CarouselModel.find({ isActive: true }).sort({ order: 1 }).lean();
    if (docs && docs.length > 0) {
      activeSlides = docs.map((c: any) => ({
        _id: c._id.toString(),
        url: c.url,
        alt: c.alt || c.altText || "",
        altText: c.alt || c.altText || "",
        publicId: c.publicId || "",
        order: c.order || 0,
        isActive: c.isActive !== false,
      }));
    }
  } catch (error) {
    console.error("Failed to query carousel images:", error);
  }

  if (activeSlides.length === 0) {
    activeSlides = [
      {
        _id: "default-1",
        url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
        altText: "Forest trail with warm morning light",
        alt: "Forest trail with warm morning light",
        publicId: "",
        order: 1,
        isActive: true
      },
      {
        _id: "default-2",
        url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2000&auto=format&fit=crop",
        altText: "Embrace the Forest",
        alt: "Embrace the Forest",
        publicId: "",
        order: 2,
        isActive: true
      },
      {
        _id: "default-3",
        url: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2000&auto=format&fit=crop",
        altText: "Sustainable Living",
        alt: "Sustainable Living",
        publicId: "",
        order: 3,
        isActive: true
      }
    ];
  }

  return (
    <HeroCarouselClient 
      slides={activeSlides} 
      className={className} 
      itemClassName={itemClassName} 
      showOverlayText={showOverlayText} 
    />
  );
}
