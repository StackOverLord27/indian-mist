import Link from "next/link";
import { Heart, Plus } from "lucide-react";

import { ImageSlot } from "@/components/home/ImageSlot";
import type { Product } from "@/lib/homepage-data";

type FeaturedProductsProps = {
  products: Product[];
};

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  return (
    <section className="bg-cornsilk px-6 py-16 md:px-12">
      <div className="mb-8 flex items-end justify-between gap-6">
        <h2 className="font-serif text-2xl font-light text-black-forest md:text-3xl">
          Featured products
        </h2>
        <Link
          href="/products"
          className="font-sans text-xs font-medium uppercase tracking-widest text-olive-leaf transition-opacity hover:opacity-70"
        >
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group rounded-home-card border border-olive-leaf/10 bg-card-bg p-3 transition-transform hover:-translate-y-1 hover:shadow-sm">
      <div className="relative aspect-square overflow-hidden rounded-home-card">
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
        <button
          type="button"
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-cornsilk text-black-forest transition-opacity hover:opacity-75"
          aria-label={`Add ${product.name} to wishlist`}
        >
          <Heart className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="px-1 pb-1 pt-4">
        <p className="font-sans text-2xs font-medium uppercase tracking-widest text-olive-leaf">
          {product.category}
        </p>
        <h3 className="mt-2 font-serif text-sm font-normal text-black-forest">
          {product.name}
        </h3>
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
