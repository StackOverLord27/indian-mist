"use client";

import { useRef, useState } from "react";
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
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Left / right arrows move between the tabs (the usual tab keyboard behaviour)
  const onTabKeys = (e: React.KeyboardEvent, index: number) => {
    const next = e.key === "ArrowRight" ? index + 1 : e.key === "ArrowLeft" ? index - 1 : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const target = (next + TABS.length) % TABS.length;
    setActiveTab(TABS[target]);
    tabRefs.current[target]?.focus();
  };

  return (
    <div className="mt-8 md:mt-12">
      {/* Tab bar: three equal parts across the whole width; the open one is underlined */}
      <div role="tablist" aria-label="Product details" className="grid grid-cols-3 border-b border-olive/20">
        {TABS.map((tab, index) => (
          <button
            key={tab}
            ref={(el) => { tabRefs.current[index] = el; }}
            type="button"
            role="tab"
            id={`product-tab-${index}`}
            aria-selected={activeTab === tab}
            aria-controls="product-tabpanel"
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(e) => onTabKeys(e, index)}
            className={cn(
              "-mb-px border-b-[3px] px-2 py-4 text-center font-montserrat text-[11px] font-semibold uppercase leading-tight tracking-wider transition-colors sm:text-sm md:py-5 md:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive/50",
              activeTab === tab
                ? "border-forest text-forest"
                : "border-transparent text-muted-text hover:bg-olive/5 hover:text-forest"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* The open tab's content, across the full width under the bar */}
      <div role="tabpanel" id="product-tabpanel" aria-labelledby={`product-tab-${TABS.indexOf(activeTab)}`} className="py-8 md:py-10">
        {activeTab === "Description" && (
          <div
            className={cn(
              "animate-in fade-in slide-in-from-bottom-2 duration-500",
              product.features?.length > 0 && "grid gap-8 lg:grid-cols-[3fr_2fr] lg:gap-16"
            )}
          >
            <p className="max-w-3xl whitespace-pre-wrap font-montserrat text-base font-normal leading-relaxed text-muted-text">
              {product.description}
            </p>
            {product.features && product.features.length > 0 && (
              <ul className="space-y-3 self-start rounded-md border border-olive/10 bg-card-surface p-5 md:p-6">
                {product.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className="mt-1 size-4 flex-shrink-0 text-olive" />
                    <span className="font-montserrat text-sm font-normal text-forest/90 md:text-base">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "Materials & Care" && (
          <div
            className={cn(
              "animate-in fade-in slide-in-from-bottom-2 duration-500",
              product.materials.length > 0 && product.careInstructions.length > 0 && "grid gap-10 lg:grid-cols-2 lg:gap-16"
            )}
          >
            {product.materials.length > 0 && (
              <div>
                <h3 className="mb-4 font-merriweather text-lg font-medium text-forest">Materials</h3>
                <ul className="space-y-3">
                  {product.materials.map((material, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="mt-1 size-4 flex-shrink-0 text-olive" />
                      <span className="font-montserrat text-sm font-normal text-muted-text md:text-base">{material}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {product.careInstructions.length > 0 && (
              <div>
                <h3 className="mb-4 font-merriweather text-lg font-medium text-forest">Care Instructions</h3>
                <ul className="space-y-3">
                  {product.careInstructions.map((instruction, idx) => {
                    const IconComp = CARE_ICON_MAP[instruction.icon] || Droplets;
                    return (
                      <li key={idx} className="flex items-start gap-3">
                        <IconComp className="mt-1 size-4 flex-shrink-0 text-olive" />
                        <span className="font-montserrat text-sm font-normal text-muted-text md:text-base">{instruction.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "Shipping" && (
          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-start gap-4 rounded-md border border-olive/10 bg-card-surface p-5">
              <Truck className="mt-0.5 size-5 flex-shrink-0 text-olive" />
              <div>
                <h4 className="mb-1 font-montserrat text-base font-semibold text-forest">Standard Delivery</h4>
                <p className="font-montserrat text-sm font-normal leading-relaxed text-muted-text">
                  {product.shippingInfo.standard ? `${product.shippingInfo.standard}. ` : ""}Shipping is calculated at checkout.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
