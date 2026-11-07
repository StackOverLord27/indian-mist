import Link from "next/link";
import { notFound } from "next/navigation";
import dbConnect from "@/lib/db";
import { Collection } from "@/models/collection.model";
import { CollectionProductGrid } from "@/components/collections/CollectionProductGrid";
import { COLLECTION_PAGE_SIZE, getCollectionBatch } from "@/lib/collection-products";
import type { Metadata } from "next";
import { cache } from "react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { NOINDEX, pageMetadata, summarise } from "@/lib/seo";

// Built on the first visit, then cached (ISR). Saving a collection or product in the admin
// refreshes it straight away (revalidateStorefront). Only the first batch of products (24) is in
// the cached page; "Load more" gets the rest from /api/collections/[slug]/products, so a big
// collection costs one small query and the page stays cacheable.
export const revalidate = 300;

export function generateStaticParams() {
  return [];
}

// Cached per render: generateMetadata and the page both need the collection
const getCollection = cache(async (slug: string) => {
  await dbConnect();
  // Only the list of product ids: the products themselves are loaded a batch at a time
  return Collection.findOne({ slug, isActive: true })
    .select("name slug description products")
    .lean<{ name: string; slug: string; description?: string; products: string[] }>();
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);

  if (!collection) return { title: "Collection Not Found", robots: NOINDEX };

  return pageMetadata({
    title: collection.name,
    description: summarise(collection.description),
    path: `/collections/${collection.slug}`,
  });
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollection(slug);

  if (!collection) notFound();

  const col = collection;
  const batch = await getCollectionBatch(col.products ?? [], 1, COLLECTION_PAGE_SIZE);

  return (
    <div className="bg-cornsilk pb-16 min-h-screen page-enter">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-10 lg:px-16 pt-6">
        <Breadcrumb
          className="pb-2"
          items={[
            { label: "Home", href: "/" },
            { label: "Collections", href: "/collections" },
            { label: col.name },
          ]}
        />
        <header className="mt-2 mb-10 pb-8 border-b border-olive/20">
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

        {batch.cards.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-merriweather text-xl text-forest mb-2">
              No products in this collection yet
            </p>
            <p className="font-montserrat text-sm text-muted-text">
              Check back later for updates.
            </p>
          </div>
        ) : (
          <CollectionProductGrid
            slug={col.slug}
            initialProducts={batch.cards}
            initialHasMore={batch.hasMore}
            pageSize={COLLECTION_PAGE_SIZE}
          />
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
