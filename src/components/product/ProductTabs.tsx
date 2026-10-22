"use client";

import { useState } from "react";
import {
  Check, Droplets, Sun, Wind, Truck, Thermometer,
  Ban, Hand, Shirt, Sparkles, RotateCcw, ShieldCheck, Info,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/get-product";

const CARE_ICON_MAP: Record<string, LucideIcon> = {
  droplets: Droplets,
  sun: Sun,
  wind: Wind,
  thermometer: Thermometer,
  ban: Ban,
  hand: Hand,
  shirt: Shirt,
  sparkles: Sparkles,
  iron: Thermometer,
  "rotate-ccw": RotateCcw,
  "shield-check": ShieldCheck,
  info: Info,
};

const TABS = ["Description", "Materials & Care", "Shipping"];

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
                : "border-transparent text-muted-text hover:text-forest hover:border-olive/30"
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
          <div className="space-y-8 max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            {product.materials.length > 0 && (
              <div>
                <h3 className="font-merriweather text-base font-medium text-forest mb-4">
                  Materials
                </h3>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {product.materials.map((material, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="text-olive size-[14px] flex-shrink-0 mt-0.5" />
                      <span className="font-montserrat text-xs text-muted-text font-normal">
                        {material}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {product.careInstructions.length > 0 && (
              <div>
                <h3 className="font-merriweather text-base font-medium text-forest mb-4">
                  Care Instructions
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  {product.careInstructions.map((instruction, idx) => {
                    const IconComp = CARE_ICON_MAP[instruction.icon] || Droplets;
                    return (
                      <div key={idx} className="flex items-start gap-2">
                        <IconComp className="text-olive size-[14px] flex-shrink-0 mt-0.5" />
                        <span className="font-montserrat text-xs text-muted-text font-normal">
                          {instruction.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "Shipping" && (
          <div className="max-w-xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-start gap-4 p-4 bg-card-surface border border-olive/10 rounded-sm">
              <Truck className="text-olive size-[18px] flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-montserrat text-sm font-semibold text-forest mb-1">
                  Standard Delivery
                </h4>
                <p className="font-montserrat text-xs text-muted-text font-normal leading-relaxed">
                  {product.shippingInfo.standard}. Shipping calculated at checkout.
                </p>
              </div>
            </div>
            {/* <div className="flex items-start gap-4 p-4 bg-card-surface border border-olive/10 rounded-sm">
              <Wind className="text-olive size-[18px] flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-montserrat text-sm font-semibold text-forest mb-1">
                  Express Delivery
                </h4>
                <p className="font-montserrat text-xs text-muted-text font-normal leading-relaxed">
                  Arrives in {product.shippingInfo.express} for an additional fee.
                </p>
              </div>
            </div> */}
          </div>
        )}

      </div>
    </div>
  );
}
