"use client";

import Link from "next/link";
import { useState } from "react";
import { Filter, ShoppingBag, ArrowUpDown, Heart, Plus } from "lucide-react";

const mockProducts = [
  { id: 1, name: "Eco Explorer Tent", price: "$299.00", category: "Tents", color: "from-green-400 to-emerald-600" },
  { id: 2, name: "Summit Ridge Backpack", price: "$149.00", category: "Backpacks", color: "from-blue-400 to-indigo-600" },
  { id: 3, name: "Alpine Trekking Poles", price: "$89.00", category: "Gear", color: "from-orange-400 to-red-600" },
  { id: 4, name: "Merino Wool Base Layer", price: "$75.00", category: "Apparel", color: "from-purple-400 to-pink-600" },
  { id: 5, name: "Solar Camping Lantern", price: "$45.00", category: "Lighting", color: "from-yellow-400 to-orange-500" },
  { id: 6, name: "Ultralight Sleeping Bag", price: "$199.00", category: "Sleep", color: "from-teal-400 to-cyan-600" },
];

export default function ProductsPage() {
  const [sortBy, setSortBy] = useState("featured");

  const sortedProducts = [...mockProducts].sort((a, b) => {
    if (sortBy === "price-low") {
      return parseFloat(a.price.replace('$', '')) - parseFloat(b.price.replace('$', ''));
    } else if (sortBy === "price-high") {
      return parseFloat(b.price.replace('$', '')) - parseFloat(a.price.replace('$', ''));
    } else if (sortBy === "name-asc") {
      return a.name.localeCompare(b.name);
    } else if (sortBy === "name-desc") {
      return b.name.localeCompare(a.name);
    }
    return 0; // featured
  });

  const placeholderColors = ["bg-[#d4e2c8]", "bg-[#e0dbc8]", "bg-[#cdd9c5]", "bg-[#d9cfc0]"];

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
          <button className="border border-olive/30 bg-card-surface rounded-sm font-montserrat text-xs uppercase tracking-wide text-forest px-4 py-2 hover:bg-warm transition-colors hidden sm:flex items-center gap-2 h-10">
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 pb-16">
        {sortedProducts.map((product, index) => (
          <div key={product.id} className="bg-card-surface border border-olive/10 rounded-md overflow-hidden hover:-translate-y-1 hover:shadow-md transition-all duration-200">
            {/* Product Image Area */}
            <div className={`aspect-square relative overflow-hidden ${placeholderColors[index % 4]} flex items-center justify-center`}>
              <div className="absolute top-2 left-2 z-10">
                <span className="bg-forest text-cornsilk text-[10px] font-montserrat font-semibold uppercase tracking-wider px-2 py-1 rounded-sm">
                  {product.category}
                </span>
              </div>
              <div className="absolute top-2 right-2 z-10">
                <button className="bg-cornsilk/80 rounded-full w-8 h-8 flex items-center justify-center text-copper hover:bg-cornsilk transition">
                  <Heart className="h-4 w-4" />
                </button>
              </div>
              <ShoppingBag size={48} className="opacity-20 text-forest" />
            </div>
            
            {/* Product Info */}
            <div className="p-4 flex flex-col">
              <p className="text-olive text-[10px] font-semibold uppercase tracking-wider font-montserrat mb-1">
                {product.category}
              </p>
              <Link href={`/products/${product.id}`} className="block">
                <h3 className="font-merriweather text-sm text-forest font-normal leading-snug mb-3 hover:underline">
                  {product.name}
                </h3>
              </Link>
              
              <div className="flex items-center justify-between mt-auto">
                <span className="font-merriweather text-lg font-bold text-forest">
                  {product.price}
                </span>
                <button className="w-8 h-8 rounded-full bg-forest text-cornsilk flex items-center justify-center hover:bg-olive transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
