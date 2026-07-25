import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug } from "@/lib/get-product";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductTabs } from "@/components/product/ProductTabs";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { Metadata } from "next";

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

  return (
    <div className="bg-cornsilk min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pb-24 lg:pb-0">
        
        {/* Breadcrumb */}
        <nav className="pt-6 pb-2 flex items-center font-montserrat text-xs text-muted-text">
          <Link href="/" className="hover:text-olive cursor-pointer transition-colors">
            Home
          </Link>
          <span className="mx-2 text-muted-text/40">›</span>
          <Link href="/products" className="hover:text-olive cursor-pointer transition-colors">
            Products
          </Link>
          <span className="mx-2 text-muted-text/40">›</span>
          <Link href={`/products?category=${encodeURIComponent(product.category)}`} className="hover:text-olive cursor-pointer transition-colors">
            {product.category}
          </Link>
          <span className="mx-2 text-muted-text/40">›</span>
          <span className="text-forest font-medium">{product.name}</span>
        </nav>

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
            }}
          />

          {/* Right Column: Product Info */}
          <ProductInfo product={product} />
        </div>

        {/* SECTION 2 — PRODUCT DETAILS TABS */}
        <ProductTabs product={product} />

        {/* SECTION 3 — YOU MAY ALSO LIKE */}
        <RelatedProducts productIds={product.relatedProductIds} />

      </div>
    </div>
  );
}
