import { Heart, Plus } from "lucide-react";
import Link from "next/link";
import { ImageSlot } from "@/components/home/ImageSlot";
import type { Product } from "@/lib/homepage-data";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group rounded-home-card border border-olive-leaf/10 bg-card-bg p-3 transition-transform hover:-translate-y-1 hover:shadow-sm">
      <Link href={`/products/${product.id}`} className="block relative aspect-square overflow-hidden rounded-home-card">
        <ImageSlot
          image={product.image}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        {product.badge ? (
          <span
            className={
              product.badge === "Sale"
                ? "absolute left-3 top-3 rounded-full bg-copperwood px-3 py-1 font-sans text-3xs font-medium uppercase tracking-widest text-cornsilk"
                : "absolute left-3 top-3 rounded-full bg-black-forest px-3 py-1 font-sans text-3xs font-medium uppercase tracking-widest text-cornsilk"
            }
          >
            {product.badge}
          </span>
        ) : null}
      </Link>
      
      <button
        type="button"
        className="absolute right-6 top-6 flex size-8 items-center justify-center rounded-full bg-cornsilk text-black-forest transition-opacity hover:opacity-75 z-10"
        aria-label={`Add ${product.name} to wishlist`}
      >
        <Heart className="size-4" aria-hidden="true" />
      </button>

      <div className="px-1 pb-1 pt-4">
        <p className="font-sans text-2xs font-medium uppercase tracking-widest text-olive-leaf">
          {product.category}
        </p>
        <Link href={`/products/${product.id}`}>
          <h3 className="mt-2 font-serif text-sm font-normal text-black-forest hover:underline">
            {product.name}
          </h3>
        </Link>
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="font-sans text-sm font-medium text-black-forest">
            {product.price}
          </p>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full bg-olive-leaf text-cornsilk transition-opacity hover:opacity-85"
            aria-label={`Add ${product.name} to bag`}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
