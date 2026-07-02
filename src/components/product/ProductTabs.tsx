"use client";

import { useState } from "react";
import { Check, Droplets, Sun, Wind, ShieldCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/get-product";

const TABS = ["Description", "Materials & Care", "Shipping", "Reviews"];

export function ProductTabs({ product }: { product: Product }) {
  const [activeTab, setActiveTab] = useState(TABS[0]);

  return (
    <div className="mt-12 md:mt-16 border-t border-olive/10 pt-8">
      {/* Tab bar */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-0 border-b border-olive/15 hide-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "font-montserrat text-xs font-semibold uppercase tracking-wider pb-3 px-1 mr-8 border-b-2 transition-colors flex-shrink-0 whitespace-nowrap",
              activeTab === tab
                ? "border-forest text-forest"
                : "border-transparent text-muted-text/70 hover:text-forest hover:border-olive/30"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="py-6">
        {activeTab === "Description" && (
          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <p className="font-montserrat text-sm font-normal text-muted-text leading-relaxed space-y-4 whitespace-pre-wrap">
              {product.description}
            </p>
            {product.features && product.features.length > 0 && (
              <div className="space-y-2 mt-4">
                {product.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="text-olive size-[14px] flex-shrink-0 mt-0.5" />
                    <span className="font-montserrat text-sm text-forest/80 font-normal">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "Materials & Care" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div>
              <h3 className="font-merriweather text-base font-medium text-forest mb-4">
                Materials
              </h3>
              {product.materials.map((material, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 py-3 border-b border-olive/10 last:border-0"
                >
                  <span className="font-montserrat text-sm text-forest font-medium">
                    {material.name}
                  </span>
                  <span className="font-montserrat text-xs text-muted-text ml-auto">
                    {material.percentage}%
                  </span>
                  <span className="font-montserrat text-xs text-olive">
                    {material.origin}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="font-merriweather text-base font-medium text-forest mb-4">
                Care Instructions
              </h3>
              {product.careInstructions.map((instruction, idx) => (
                <div key={idx} className="flex items-start gap-2 mb-3">
                  {/* Just cycle through a few icons for visual variety */}
                  {idx % 3 === 0 ? (
                    <Droplets className="text-olive size-[14px] flex-shrink-0 mt-0.5" />
                  ) : idx % 3 === 1 ? (
                    <Sun className="text-olive size-[14px] flex-shrink-0 mt-0.5" />
                  ) : (
                    <Wind className="text-olive size-[14px] flex-shrink-0 mt-0.5" />
                  )}
                  <span className="font-montserrat text-xs text-muted-text font-normal">
                    {instruction}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Shipping" && (
          <div className="max-w-xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-start gap-4 p-4 bg-card-surface border border-olive/10 rounded-sm">
              <ShieldCheck className="text-olive size-[18px] flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-montserrat text-sm font-semibold text-forest mb-1">
                  Standard Delivery
                </h4>
                <p className="font-montserrat text-xs text-muted-text font-normal leading-relaxed">
                  Arrives in {product.shippingInfo.standard}.{" "}
                  {product.shippingInfo.free ? "Free on this order." : "Shipping calculated at checkout."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-card-surface border border-olive/10 rounded-sm">
              <Wind className="text-olive size-[18px] flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-montserrat text-sm font-semibold text-forest mb-1">
                  Express Delivery
                </h4>
                <p className="font-montserrat text-xs text-muted-text font-normal leading-relaxed">
                  Arrives in {product.shippingInfo.express} for an additional fee.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Reviews" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-6 mb-8">
              <div className="font-merriweather text-5xl text-forest font-medium">
                {product.rating.toFixed(1)}
              </div>
              <div>
                <div className="flex gap-1 text-clay mb-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "size-4",
                        star <= Math.round(product.rating)
                          ? "fill-clay text-clay"
                          : "text-muted-text/30"
                      )}
                    />
                  ))}
                </div>
                <div className="font-montserrat text-sm text-muted-text">
                  ({product.reviewCount} reviews)
                </div>
              </div>
            </div>

            {/* Mock Reviews List */}
            <div className="space-y-0">
              <div className="border-b border-olive/10 py-5 last:border-0">
                <div className="flex justify-between items-start">
                  <span className="font-montserrat text-sm font-semibold text-forest">
                    Sarah M.
                  </span>
                  <span className="font-montserrat text-xs text-muted-text">
                    Oct 12, 2025
                  </span>
                </div>
                <div className="flex gap-0.5 text-clay mt-1 mb-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="size-[12px] fill-clay" />
                  ))}
                </div>
                <p className="font-montserrat text-sm font-normal text-muted-text leading-relaxed">
                  Absolutely love the quality. It feels sturdy yet surprisingly light. The natural colors match the pictures perfectly!
                </p>
                <div className="mt-2 text-[10px] font-montserrat font-medium text-olive uppercase tracking-wide flex items-center gap-1">
                  <ShieldCheck className="size-[10px]" /> Verified Buyer
                </div>
              </div>

              <div className="border-b border-olive/10 py-5 last:border-0">
                <div className="flex justify-between items-start">
                  <span className="font-montserrat text-sm font-semibold text-forest">
                    David K.
                  </span>
                  <span className="font-montserrat text-xs text-muted-text">
                    Sep 28, 2025
                  </span>
                </div>
                <div className="flex gap-0.5 text-clay mt-1 mb-2">
                  {[1, 2, 3, 4].map((s) => (
                    <Star key={s} className="size-[12px] fill-clay" />
                  ))}
                  <Star className="size-[12px] text-muted-text/30" />
                </div>
                <p className="font-montserrat text-sm font-normal text-muted-text leading-relaxed">
                  Great materials and fits well with my other gear. A bit pricey but knowing it's organic makes it worth it for me.
                </p>
                <div className="mt-2 text-[10px] font-montserrat font-medium text-olive uppercase tracking-wide flex items-center gap-1">
                  <ShieldCheck className="size-[10px]" /> Verified Buyer
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
