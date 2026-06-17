"use client";

import Link from "next/link";
import { useState } from "react";
import { Filter, ShoppingBag, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Our Products</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Discover our complete range of sustainable, high-performance gear.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center">
          <div className="relative flex items-center bg-background border border-input rounded-full h-10 px-3 shadow-sm w-full sm:w-auto focus-within:ring-1 focus-within:ring-primary transition-colors">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground mr-2 flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-sm text-foreground focus-visible:outline-none cursor-pointer appearance-none pr-6 w-full sm:w-auto"
            >
              <option value="featured">Sort by: Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
            </select>
          </div>
          <Button variant="outline" className="rounded-full gap-2 hidden sm:flex">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {sortedProducts.map((product) => (
          <div key={product.id} className="group relative rounded-2xl border border-border bg-card overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            {/* Product Image Area (Gradient Placeholder) */}
            <div className={`w-full h-64 bg-gradient-to-br ${product.color} opacity-80 group-hover:opacity-100 transition-opacity duration-300 relative overflow-hidden flex items-center justify-center`}>
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300" />
              <ShoppingBag className="h-16 w-16 text-white/50 group-hover:scale-110 transition-transform duration-500" />
            </div>
            
            {/* Product Info */}
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm text-primary font-medium mb-1">{product.category}</p>
                  <h3 className="text-xl font-semibold text-card-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {product.name}
                  </h3>
                </div>
                <p className="text-lg font-bold text-foreground bg-secondary/50 px-3 py-1 rounded-full">
                  {product.price}
                </p>
              </div>
              
              <div className="mt-6 flex items-center gap-3">
                <Button className="w-full rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  Add to Cart
                </Button>
                <Link href={`/products/${product.id}`} className="w-full">
                  <Button variant="outline" className="w-full rounded-full">
                    Details
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
