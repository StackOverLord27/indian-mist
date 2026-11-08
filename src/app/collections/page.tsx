import Link from "next/link";
import dbConnect from "@/lib/db";
import { Collection } from "@/models/collection.model";
import { ProductCard } from "@/components/home/ProductCard";
import { COLLECTION_PREVIEW_SIZE, getProductsByIds, toCardProduct } from "@/lib/collection-products";
import { getCategoryNames } from "@/lib/storefront-data";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "Collections", path: "/collections" });

// Cached page. Saving a collection or product in the admin refreshes it straight away
// (revalidateStorefront). Each collection shows a preview of its first 8 products with a link to
// its own page (which loads the rest in batches), so the page stays small however big the
// collections are: two queries in total, whatever the number of collections.
export const revalidate = 300;

export default async function CollectionsPage() {
  await dbConnect();

  const collections = await Collection.find({ isActive: true })
    .select("name slug description products")
    .sort({ order: 1, createdAt: 1, _id: 1 })
    .lean<{ _id: { toString(): string }; name: string; slug: string; description?: string; products?: string[] }[]>();

  // ONE query for the preview products of every collection, then split them back up
  const previewIds = collections.flatMap((c) => (c.products ?? []).slice(0, COLLECTION_PREVIEW_SIZE));
  const [previewProducts, names] = await Promise.all([getProductsByIds(previewIds), getCategoryNames()]);
  const byId = new Map(previewProducts.map((p) => [p._id.toString(), p]));

  return (
    <div className="bg-cornsilk min-h-screen pb-16 page-enter">
      <div className="mx-auto w-full max-w-page px-4 sm:px-6 md:px-10 lg:px-16 pt-6">
      <Breadcrumb className="pb-2" items={[{ label: "Home", href: "/" }, { label: "Collections" }]} />
      {/* Page header with a thin green accent */}
      <header className="mt-2 mb-10 pb-8 border-b border-olive/20">
        <div className="space-y-2 max-w-prose">
          <h1 className="font-merriweather text-3xl md:text-4xl font-normal text-forest">
            Curated Collections
          </h1>
          <p className="font-montserrat text-sm font-light text-muted-text mt-2">
            Discover items grouped by causes and themes. Thoughtfully put
            together for your journey.
          </p>
        </div>
      </header>
      </div>

      {collections.length === 0 ? (
        <div className="mx-auto w-full max-w-page px-4 sm:px-6 md:px-10 lg:px-16 py-24 text-center">
          <p className="font-merriweather text-xl text-forest mb-2">
            No collections found
          </p>
          <p className="font-montserrat text-sm text-muted-text">
            Check back later for curated collections.
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {collections.map((collection, index) => {
            const previewList = (collection.products ?? [])
              .slice(0, COLLECTION_PREVIEW_SIZE)
              .map((id) => byId.get(String(id)))
              .filter((p): p is NonNullable<typeof p> => Boolean(p));
            if (previewList.length === 0) return null;
            const hasMore = (collection.products?.length ?? 0) > COLLECTION_PREVIEW_SIZE;

            const isEven = index % 2 === 0;

            return (
              <section
                key={collection._id.toString()}
                className={`py-12 ${isEven ? "" : "bg-warm-mist/40"}`}
              >
                <div className="mx-auto w-full max-w-page px-4 sm:px-6 md:px-10 lg:px-16">
                <div className="mb-6 flex items-baseline gap-4">
                  {/* Faint index number in forest green */}
                  <span className="font-merriweather text-5xl font-normal text-forest/10 select-none leading-none">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2 className="font-merriweather text-xl md:text-2xl font-normal text-forest mb-1">
                      {collection.name}
                    </h2>
                    {collection.description && (
                      <p className="font-montserrat text-sm font-light text-forest/80 max-w-prose leading-relaxed">
                        {collection.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
                  {previewList.map((p) => (
                    <ProductCard key={p._id.toString()} product={toCardProduct(p, names)} />
                  ))}
                </div>
                {hasMore && (
                  <div className="mt-6">
                    <Link
                      href={`/collections/${collection.slug}`}
                      className="font-montserrat text-xs font-semibold uppercase tracking-widest text-olive-leaf transition-opacity hover:opacity-70"
                    >
                      View all in {collection.name} →
                    </Link>
                  </div>
                )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
