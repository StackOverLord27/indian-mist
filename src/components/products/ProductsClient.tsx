"use client";

import toast from "react-hot-toast";
import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUpDown, Check, Filter, Search } from "lucide-react";
import { ProductCard } from "@/components/home/ProductCard";
import { ProductCardSkeleton } from "@/components/ui/skeletons";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import type { ListingProduct, FacetItem as ListingFacet, ListingFacets } from "@/lib/product-listing";

// Sort choices (value = what the listing API / URL state uses, label = what the shopper sees)
const SORT_OPTIONS = [
  { value: "featured", label: "Sort by: Featured" },
  { value: "newest", label: "Newest Arrivals" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "name-asc", label: "Name: A to Z" },
  { value: "name-desc", label: "Name: Z to A" },
] as const;

// Filter and Sort buttons look and behave the same: the whole button is the click target
const TOOLBAR_BUTTON =
  "inline-flex items-center justify-center whitespace-nowrap h-10 px-4 border border-olive/30 bg-card-surface hover:bg-warm w-full sm:w-auto rounded-sm transition-colors text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive/50";

type ProductItem = ListingProduct;
type FacetItem = ListingFacet;
type Facets = ListingFacets;

const BATCH_SIZE = 12;

export default function ProductsClient({
  initialProducts,
  initialFacets,
  initialHasMore,
  initialTotal,
  initialCategories,
  initialSort,
}: {
  initialProducts: ProductItem[],
  initialFacets: Facets,
  initialHasMore: boolean,
  initialTotal: number,
  initialCategories: string[],
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
  const [sortOpen, setSortOpen] = useState(false);
  const selectedSortRef = useRef<HTMLButtonElement | null>(null);
  const currentSort = SORT_OPTIONS.find((o) => o.value === sortBy) ?? SORT_OPTIONS[0];

  // Arrow keys / Home / End move between the sort options (Enter and Space press the focused one, Escape closes)
  const handleSortKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'));
    const at = items.indexOf(document.activeElement as HTMLElement);
    const move = (i: number) => { e.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
    if (e.key === "ArrowDown") move(at + 1);
    else if (e.key === "ArrowUp") move(at - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
  };
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories);
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
    <div className="bg-cornsilk pb-8 min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-10 lg:px-16 pt-6">
      <Breadcrumb className="pb-2" items={[{ label: "Home", href: "/" }, { label: "All Products" }]} />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mt-2 mb-8 gap-6">
        <div className="space-y-2 max-w-prose">
          <h1 className="font-merriweather text-3xl md:text-4xl font-normal text-forest">All Products</h1>
          <p className="font-montserrat text-sm font-light text-muted-text mt-2 max-w-prose">
            Browse our full range.
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
            <PopoverTrigger className={TOOLBAR_BUTTON}>
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

          {/* Sort By: same button as Filter, option list in the same Popover */}
          <Popover open={sortOpen} onOpenChange={setSortOpen}>
            <PopoverTrigger
              className={TOOLBAR_BUTTON}
              aria-haspopup="listbox"
              aria-label={`Sort products, current choice: ${currentSort.label}`}
            >
              <ArrowUpDown className="mr-2 h-4 w-4 text-forest" aria-hidden="true" />
              <span className="font-montserrat text-xs uppercase tracking-wide text-forest">{currentSort.label}</span>
            </PopoverTrigger>
            <PopoverContent
              className="w-60 p-1.5 bg-card-surface border-olive/20 shadow-lg rounded-md gap-0"
              align="end"
              initialFocus={selectedSortRef}
            >
              <div role="listbox" aria-label="Sort products" onKeyDown={handleSortKeys} className="flex flex-col">
                {SORT_OPTIONS.map((option) => {
                  const active = option.value === sortBy;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      ref={active ? selectedSortRef : undefined}
                      onClick={() => {
                        setSortBy(option.value);
                        setSortOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2.5 text-left font-montserrat text-xs uppercase tracking-wide text-forest transition-colors hover:bg-warm focus-visible:bg-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive/50 ${active ? "font-semibold" : ""}`}
                    >
                      {option.label}
                      {active && <Check className="h-4 w-4 shrink-0 text-olive" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
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
              productId: product.id,
              name: product.name,
              category: product.categoryLabel,
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
