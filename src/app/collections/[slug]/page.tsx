import Link from "next/link";
import { notFound } from "next/navigation";
import dbConnect from "@/lib/db";
import { Collection } from "@/models/collection.model";
import { Product as ProductModel } from "@/models/product.model";
import { ProductCard } from "@/components/home/ProductCard";
import type { Product } from "@/lib/homepage-data";
import type { Metadata } from "next";

export const revalidate = 0;

const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN")}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  await dbConnect();
  const collection = await Collection.findOne({ slug, isActive: true })
    .select("name description")
    .lean();

  if (!collection) return { title: "Collection Not Found" };

  return {
    title: `${(collection as any).name} | Indian Mist`,
    description: (collection as any).description || undefined,
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await dbConnect();
  ProductModel.init();

  const collection = await Collection.findOne({ slug, isActive: true })
    .populate("products")
    .lean();

  if (!collection) notFound();

  const col = collection as any;
  const products = (col.products || []).filter(Boolean);

  return (
    <div className="bg-cornsilk px-4 sm:px-6 md:px-12 lg:px-16 pt-12 pb-16 min-h-screen">
      <div className="mx-auto max-w-screen-2xl">
        <header className="mb-10 pb-8 border-b border-olive/20">
          <div className="space-y-2 max-w-prose">
            <h1 className="font-merriweather text-3xl md:text-4xl font-normal text-forest">
              {col.name}
            </h1>
            {col.description && (
              <p className="font-montserrat text-sm font-light text-muted-text mt-2">
                {col.description}
              </p>
            )}
          </div>
        </header>

        {products.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-merriweather text-xl text-forest mb-2">
              No products in this collection yet
            </p>
            <p className="font-montserrat text-sm text-muted-text">
              Check back later for updates.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p: any) => {
              const formattedProduct: Product = {
                id: p.slug || p._id.toString(),
                name: p.name,
                category: p.category,
                price: formatPrice(p.price),
                badge: p.badge,
                sizes: Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : undefined,
                image: {
                  src: p.images?.[0]?.url || undefined,
                  alt: p.images?.[0]?.alt || p.name,
                  fallbackClassName: "bg-olive-leaf/20",
                },
              };

              return (
                <ProductCard key={p._id.toString()} product={formattedProduct} />
              );
            })}
          </div>
        )}

        <div className="mt-16 flex justify-center">
          <Link
            href="/collections"
            className="inline-flex items-center gap-2 rounded-full border border-olive-leaf/30 px-6 py-3 font-montserrat text-xs font-semibold uppercase tracking-widest text-forest transition-colors hover:bg-forest hover:text-cornsilk"
          >
            ← Explore All Collections
          </Link>
        </div>
      </div>
    </div>
  );
}
