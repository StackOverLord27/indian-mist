"use client";

import Link from "next/link";

/**
 * RelatedProducts — "You may also like" section.
 *
 * Currently renders nothing because `relatedProductIds` are not yet populated
 * in the database. When real related-product data is available, this component
 * should fetch them via an API route (e.g. GET /api/products?ids=a,b,c) since
 * it's rendered inside client components and can't do direct DB queries.
 */
export function RelatedProducts({ productIds }: { productIds: string[] }) {
  // No related products to show yet — early return.
  if (!productIds || productIds.length === 0) return null;

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

        <p className="font-montserrat text-sm text-muted-text">
          Related product recommendations coming soon.
        </p>
      </div>
    </div>
  );
}
