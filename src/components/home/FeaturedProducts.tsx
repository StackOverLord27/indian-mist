import Link from "next/link";
import { Heart, Plus } from "lucide-react";

import { ImageSlot } from "@/components/home/ImageSlot";
import { ProductCard } from "@/components/home/ProductCard";
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

