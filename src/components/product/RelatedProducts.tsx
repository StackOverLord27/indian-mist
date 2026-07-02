import Link from "next/link";
import { ProductCard } from "@/components/home/ProductCard";
import { mockProducts } from "@/lib/get-product";
import type { Product as HomeProduct } from "@/lib/homepage-data";

export function RelatedProducts({ productIds }: { productIds: string[] }) {
  // Map our detailed products to the HomeProduct shape expected by ProductCard
  const relatedProducts: HomeProduct[] = productIds
    .map((id) => mockProducts.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .slice(0, 4)
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: `₹${p.price.toLocaleString("en-IN")}`,
      badge: p.badge,
      image: {
        src: p.images[0] || "",
        alt: p.name,
        fallbackClassName: "bg-olive-leaf/20",
      },
    }));

  if (relatedProducts.length === 0) return null;

  return (
    <div className="mt-16 pt-10 border-t border-olive/10">
      <div className="bg-warm -mx-4 sm:-mx-6 md:-mx-10 lg:-mx-16 px-4 sm:px-6 md:px-10 lg:px-16 py-12">
        <div className="flex justify-between items-baseline mb-8">
          <h2 className="font-merriweather text-2xl font-medium text-forest">
            You may also like
          </h2>
          <Link
            href="/products"
            className="font-montserrat text-xs uppercase tracking-wider text-olive hover:text-copper transition-colors"
          >
            View all &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {relatedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
