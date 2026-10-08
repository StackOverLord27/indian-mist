"use client";

import toast from "react-hot-toast";
import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUpDown, Filter, Search } from "lucide-react";
import { ProductCard } from "@/components/home/ProductCard";
import { ProductCardSkeleton } from "@/components/ui/skeletons";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
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
  hasSizes?: boolean;
  sizes?: string[];
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
  initialHasMore,
  initialTotal,
  initialCategory,
  initialSort,
}: {
  initialProducts: ProductItem[],
  initialFacets: Facets,
  initialHasMore: boolean,
  initialTotal: number,
  initialCategory?: string,
  initialSort?: string,
}) {
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [facets, setFacets] = useState<Facets>(initialFacets);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Filters, sort, and search
  const [sortBy, setSortBy] = useState(initialSort || "featured");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategory ? [initialCategory] : []);
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Prevent initial mount from re-fetching
  const isMounted = useRef(false);

  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchProducts = useCallback(async (
    currentPage: number,
    isAppend: boolean,
    sort: string,
    cats: string[],
    badges: string[],
    query: string
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
      if (query) params.append("q", query);

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
      setTotalCount(data.total);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't load products. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // When filters, sort, or search change, reset to page 1 and fetch fresh data
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    setPage(1);
    fetchProducts(1, false, sortBy, selectedCategories, selectedBadges, searchQuery);
  }, [sortBy, selectedCategories, selectedBadges, searchQuery, fetchProducts]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 400);
  };

  // Infinite scroll
  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProducts(nextPage, true, sortBy, selectedCategories, selectedBadges, searchQuery);
  }, [page, hasMore, isLoading, sortBy, selectedCategories, selectedBadges, searchQuery, fetchProducts]);

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
    <div className="bg-cornsilk px-4 sm:px-6 md:px-12 lg:px-16 pt-12 pb-8 min-h-screen">
      <div className="mx-auto max-w-screen-2xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div className="space-y-2 max-w-prose">
          <h1 className="font-merriweather text-3xl md:text-4xl font-normal text-forest">All Products</h1>
          <p className="font-montserrat text-sm font-light text-muted-text mt-2 max-w-prose">
            Discover our complete range of sustainable, high-performance gear.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          {/* Search */}
          <div className="relative flex items-center border border-olive/30 bg-card-surface rounded-sm h-10 w-full sm:w-auto transition-colors focus-within:border-olive-leaf">
            <Search className="h-4 w-4 text-forest ml-3 shrink-0" />
            <input
              type="text"
              placeholder="Search products..."
              onChange={handleSearchChange}
              className="bg-transparent font-montserrat text-xs text-forest focus-visible:outline-none px-3 py-2 w-full sm:w-44 placeholder:text-muted-text"
            />
          </div>
          
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
                          <span className="text-xs text-muted-text font-mono">({c.count})</span>
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
                          <span className="text-xs text-muted-text font-mono">({b.count})</span>
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
            <ArrowUpDown className="h-4 w-4 text-forest mr-2 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent font-montserrat text-xs uppercase tracking-wide text-forest focus-visible:outline-none cursor-pointer appearance-none pr-6 w-full sm:w-auto"
            >
              <option value="featured">Sort by: Featured</option>
              <option value="newest">Newest Arrivals</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
            </select>
          </div>
        </div>
      </div>

      <p className="font-montserrat text-xs text-muted-text mb-6">
        {totalCount} {totalCount === 1 ? "product" : "products"}{searchQuery || selectedCategories.length > 0 || selectedBadges.length > 0 ? " found" : ""}
      </p>

      {products.length === 0 && !isLoading && (
        <div className="py-24 text-center">
          <p className="font-merriweather text-xl text-forest mb-2">No products found</p>
          <p className="font-montserrat text-sm text-muted-text">Try adjusting your filters.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 pb-16">
        {products.map((product) => (
          <ScrollReveal key={product.id}>
          <ProductCard
            product={{
              id: product.slug,
              name: product.name,
              category: product.category,
              price: product.price,
              badge: product.badge,
              sizes: product.sizes,
              image: {
                src: product.images?.[0] || undefined,
                alt: product.name,
                fallbackClassName: "bg-olive-leaf/20",
              },
            }}
          />
          </ScrollReveal>
        ))}

        {(hasMore || isLoading) &&
          Array.from({ length: isLoading ? BATCH_SIZE : Math.min(BATCH_SIZE, 4) }).map((_, i) => (
            <ProductCardSkeleton key={`skel-${i}`} />
          ))}
      </div>

      {/* Scroll sentinel — triggers loading the next batch */}
      {hasMore && !isLoading && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
      </div>
    </div>
  );
}
