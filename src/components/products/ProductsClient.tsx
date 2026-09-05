"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUpDown, Heart, Plus, ShoppingBag, Filter } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useWishlistStore } from "@/lib/wishlist-store";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
// import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface ProductItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: string;
  images: string[];
  badge?: "New" | "Sale" | "Sold Out";
}

interface FacetItem {
  name: string;
  value: string;
  count: number;
}

interface Facets {
  categories: FacetItem[];
  badges: FacetItem[];
}

const BATCH_SIZE = 12;

export default function ProductsClient({ 
  initialProducts, 
  initialFacets,
  initialHasMore
}: { 
  initialProducts: ProductItem[], 
  initialFacets: Facets,
  initialHasMore: boolean 
}) {
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [facets, setFacets] = useState<Facets>(initialFacets);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Filters and sort
  const [sortBy, setSortBy] = useState("featured");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);

  // Prevent initial mount from re-fetching
  const isMounted = useRef(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const addCartItem = useCartStore((s) => s.addItem);
  const toggleWishlist = useWishlistStore((s) => s.toggleItem);
  const wishlistItems = useWishlistStore((s) => s.items);

  const fetchProducts = useCallback(async (
    currentPage: number, 
    isAppend: boolean, 
    sort: string, 
    cats: string[], 
    badges: string[]
  ) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: BATCH_SIZE.toString(),
        sort,
      });

      if (cats.length > 0) params.append("category", cats.join(","));
      if (badges.length > 0) params.append("badge", badges.join(","));

      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch products");

      const data = await res.json();
      
      if (isAppend) {
        setProducts((prev) => [...prev, ...data.products]);
      } else {
        setProducts(data.products);
      }
      
      setFacets(data.facets);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // When filters or sort change, reset to page 1 and fetch fresh data
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    setPage(1);
    fetchProducts(1, false, sortBy, selectedCategories, selectedBadges);
  }, [sortBy, selectedCategories, selectedBadges, fetchProducts]);

  // Infinite scroll
  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProducts(nextPage, true, sortBy, selectedCategories, selectedBadges);
  }, [page, hasMore, isLoading, sortBy, selectedCategories, selectedBadges, fetchProducts]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const placeholderColors = ["bg-[#d4e2c8]", "bg-[#e0dbc8]", "bg-[#cdd9c5]", "bg-[#d9cfc0]"];

  function handleAddToCart(product: ProductItem) {
    if (product.badge === "Sold Out") return;
    addCartItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      category: product.category,
      price: parseFloat(product.price.replace(/[^\d.-]/g, "")),
      image: product.images?.[0] ?? "",
      quantity: 1,
    });
  }

  function handleToggleWishlist(product: ProductItem) {
    toggleWishlist({
      id: product.id,
      slug: product.slug,
      name: product.name,
      category: product.category,
      price: parseFloat(product.price.replace(/[^\d.-]/g, "")),
      badge: product.badge,
      image: product.images?.[0] ?? "",
    });
  }

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleBadge = (badge: string) => {
    setSelectedBadges((prev) =>
      prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge]
    );
  };

  return (
    <div className="bg-cornsilk px-6 md:px-12 lg:px-16 pt-12 pb-8 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div className="space-y-2 max-w-prose">
          <h1 className="font-merriweather text-3xl md:text-4xl font-normal text-forest">All Products</h1>
          <p className="font-montserrat text-sm font-light text-muted-text mt-2 max-w-prose">
            Discover our complete range of sustainable, high-performance gear.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center">
          
          {/* Filters Dropdown */}
          <Popover>
            <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap h-10 px-4 border border-olive/30 bg-card-surface hover:bg-warm w-full sm:w-auto rounded-sm transition-colors text-sm font-medium">
              <Filter className="mr-2 h-4 w-4 text-forest" />
              <span className="font-montserrat text-xs uppercase tracking-wide text-forest">Filter</span>
              {(selectedCategories.length > 0 || selectedBadges.length > 0) && (
                <span className="ml-2 bg-olive text-cornsilk rounded-full w-5 h-5 flex items-center justify-center text-[10px]">
                  {selectedCategories.length + selectedBadges.length}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-64 p-5 bg-card-surface border-olive/20 shadow-lg rounded-md" align="end">
              
              <div className="space-y-5">
                {/* Category Filter */}
                {facets.categories.length > 0 && (
                  <div>
                    <h4 className="font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-3">Category</h4>
                    <div className="space-y-2">
                      {facets.categories.map((c) => (
                        <div key={c.value} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`cat-${c.value}`} 
                            checked={selectedCategories.includes(c.value)}
                            onCheckedChange={() => toggleCategory(c.value)}
                            className="border-olive/50 data-[state=checked]:bg-forest data-[state=checked]:text-cornsilk rounded-[2px]"
                          />
                          <label 
                            htmlFor={`cat-${c.value}`}
                            className="text-sm font-montserrat text-black-forest cursor-pointer flex-1"
                          >
                            {c.name}
                          </label>
                          <span className="text-xs text-muted-text/60 font-mono">({c.count})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {facets.categories.length > 0 && facets.badges.length > 0 && (
                  <hr className="border-olive/10" />
                )}

                {/* Status Filter */}
                {facets.badges.length > 0 && (
                  <div>
                    <h4 className="font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-3">Status</h4>
                    <div className="space-y-2">
                      {facets.badges.map((b) => (
                        <div key={b.value} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`badge-${b.value}`} 
                            checked={selectedBadges.includes(b.value)}
                            onCheckedChange={() => toggleBadge(b.value)}
                            className="border-olive/50 data-[state=checked]:bg-forest data-[state=checked]:text-cornsilk rounded-[2px]"
                          />
                          <label 
                            htmlFor={`badge-${b.value}`}
                            className="text-sm font-montserrat text-black-forest cursor-pointer flex-1"
                          >
                            {b.name}
                          </label>
                          <span className="text-xs text-muted-text/60 font-mono">({b.count})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(selectedCategories.length > 0 || selectedBadges.length > 0) && (
                <div className="mt-5 pt-4 border-t border-olive/10">
                  <button
                    onClick={() => {
                      setSelectedCategories([]);
                      setSelectedBadges([]);
                    }}
                    className="text-xs font-montserrat font-medium text-copper hover:underline uppercase tracking-wider w-full text-left"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Sort By Dropdown */}
          <div className="relative flex items-center border border-olive/30 bg-card-surface rounded-sm h-10 px-3 w-full sm:w-auto transition-colors hover:bg-warm">
            <ArrowUpDown className="h-4 w-4 text-forest mr-2 flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent font-montserrat text-xs uppercase tracking-wide text-forest focus-visible:outline-none cursor-pointer appearance-none pr-6 w-full sm:w-auto"
            >
              <option value="featured">Sort by: Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
            </select>
          </div>
        </div>
      </div>

      {products.length === 0 && !isLoading && (
        <div className="py-24 text-center">
          <p className="font-merriweather text-xl text-forest mb-2">No products found</p>
          <p className="font-montserrat text-sm text-muted-text">Try adjusting your filters.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 pb-16">
        {products.map((product, index) => {
          const isWishlisted = wishlistItems.some((i) => i.id === product.id);
          const isSoldOut = product.badge === "Sold Out";

          return (
            <div key={product.id} className={cn("bg-card-surface border border-olive/10 rounded-md overflow-hidden hover:-translate-y-1 hover:shadow-md transition-all duration-200", isSoldOut && "opacity-75")}>
              {/* Product Image Area */}
              <div className={cn(`aspect-square relative overflow-hidden ${placeholderColors[index % 4]} flex items-center justify-center`, isSoldOut && "opacity-60 grayscale")}>
                {product.images && product.images.length > 0 ? (
                  <Link href={`/products/${product.slug}`} className="absolute inset-0">
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    />
                  </Link>
                ) : (
                  <Link href={`/products/${product.slug}`} className="absolute inset-0 flex items-center justify-center">
                    <ShoppingBag size={48} className="opacity-20 text-forest" />
                  </Link>
                )}
                
                <div className="absolute top-2 left-2 z-10">
                  <span className="bg-forest text-cornsilk text-[10px] font-montserrat font-semibold uppercase tracking-wider px-2 py-1 rounded-sm">
                    {product.category}
                  </span>
                </div>
                {product.badge && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                    <span className={cn(
                      "text-cornsilk text-[10px] font-montserrat font-semibold uppercase tracking-wider px-2 py-1 rounded-sm",
                      product.badge === "Sold Out" ? "bg-muted-text/80" : 
                      product.badge === "Sale" ? "bg-copperwood" : "bg-black-forest"
                    )}>
                      {product.badge}
                    </span>
                  </div>
                )}
                <div className="absolute top-2 right-2 z-10">
                  <button
                    type="button"
                    onClick={() => handleToggleWishlist(product)}
                    aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                    className="bg-cornsilk/80 rounded-full w-8 h-8 flex items-center justify-center text-copper hover:bg-cornsilk transition"
                  >
                    <Heart
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isWishlisted ? "fill-copper text-copper" : "text-black-forest"
                      )}
                    />
                  </button>
                </div>
              </div>
              
              {/* Product Info */}
              <div className="p-4 flex flex-col">
                <p className="text-olive text-[10px] font-semibold uppercase tracking-wider font-montserrat mb-1">
                  {product.category}
                </p>
                <Link href={`/products/${product.slug}`} className="block">
                  <h3 className="font-merriweather text-sm text-forest font-normal leading-snug mb-3 hover:underline">
                    {product.name}
                  </h3>
                </Link>
                
                <div className="flex items-center justify-between mt-auto">
                  <span className="font-merriweather text-lg font-bold text-forest">
                    {product.price}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddToCart(product)}
                    disabled={isSoldOut}
                    aria-label={`Add ${product.name} to bag`}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                      isSoldOut ? "bg-muted-text/30 text-cornsilk cursor-not-allowed" : "bg-forest text-cornsilk hover:bg-olive"
                    )}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Skeleton placeholders for the next batch (visible while loading) */}
        {(hasMore || isLoading) &&
          Array.from({ length: isLoading ? BATCH_SIZE : Math.min(BATCH_SIZE, 4) }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="bg-card-surface border border-olive/10 rounded-md overflow-hidden"
            >
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-2 w-14" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="w-8 h-8 rounded-full" />
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Scroll sentinel — triggers loading the next batch */}
      {hasMore && !isLoading && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
    </div>
  );
}
