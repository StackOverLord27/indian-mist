import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/get-product";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductTabs } from "@/components/product/ProductTabs";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Metadata } from "next";
import { getSiteSettings } from "@/lib/storefront-data";

// Product pages are built on the first visit and then kept as ISR pages (nothing is prebuilt, so
// the build does not read the database for them). Stock shown here is at most a minute old; the
// cart and checkout always re-check stock on the server. Admin product edits and sales refresh
// these pages straight away (revalidateStorefront / revalidateCatalog).
export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Product Not Found | Indian Mist",
    };
  }

  return {
    title: `${product.name} | Indian Mist`,
    description: product.description,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  let sizeChartUrl: string | undefined;
  if (product.sizes?.length) {
    const settings = await getSiteSettings();
    sizeChartUrl = settings?.sizeChart?.url || undefined;
  }

  return (
    <div className="bg-cornsilk min-h-screen page-enter">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pb-24 lg:pb-0">
        
        {/* Breadcrumb */}
        <Breadcrumb
          className="pt-6 pb-2"
          items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: product.name },
          ]}
        />

        {/* SECTION 1 — PRODUCT HERO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 py-8 md:py-12">
          {/* Left Column: Image Gallery */}
          <ProductGallery
            images={product.images}
            badge={product.badge}
            wishlistItem={{
              id: product.id,
              slug: product.slug,
              name: product.name,
              category: product.category,
              price: product.price,
              originalPrice: product.originalPrice,
              badge: product.badge,
              image: product.images[0] ?? "",
              hasSizes: !!product.sizes?.length,
            }}
          />

          {/* Right Column: Product Info */}
          <ProductInfo key={product.id} product={product} sizeChartUrl={sizeChartUrl} />
        </div>

        {/* SECTION 2 — PRODUCT DETAILS TABS */}
        <ProductTabs product={product} />

        {/* SECTION 3 — YOU MAY ALSO LIKE */}
        <RelatedProducts productIds={product.relatedProductIds} />

      </div>
    </div>
  );
}
