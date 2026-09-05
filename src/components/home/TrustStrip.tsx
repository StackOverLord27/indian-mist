import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface TrustStripItemProps {
  icon: string;
  title: string;
  subtitle: string;
}

interface TrustStripProps {
  items?: TrustStripItemProps[];
}

const defaultTrustItems: TrustStripItemProps[] = [
  { icon: "Truck", title: "Free shipping", subtitle: "Above ₹999" },
  { icon: "Leaf", title: "1 tree per order", subtitle: "Planted with care" },
  { icon: "Recycle", title: "Sustainable materials", subtitle: "Low-impact goods" },
  { icon: "ShieldCheck", title: "Easy returns", subtitle: "Simple exchanges" },
  { icon: "Award", title: "Ethically sourced", subtitle: "Traceable makers" },
];

export function TrustStrip({ items = defaultTrustItems }: TrustStripProps) {
  const displayItems = items && items.length > 0 ? items : defaultTrustItems;

  return (
    <section className="bg-warm-mist">
      <div className="flex flex-col sm:flex-row flex-wrap justify-center divide-y divide-olive-leaf/20 sm:divide-y-0 sm:divide-x">
        {displayItems.map((item, index) => {
          // Fallback to Leaf if icon not found
          const IconComponent = (Icons as any)[item.icon] as LucideIcon || Icons.Leaf;
          
          return (
            <div
              key={index}
              className="flex-1 flex items-center gap-3 px-6 py-5 min-w-[200px] max-w-sm justify-center"
            >
              <IconComponent className="size-5 shrink-0 text-olive-leaf" aria-hidden="true" />
              <div>
                <h2 className="font-sans text-xs font-semibold text-black-forest">
                  {item.title}
                </h2>
                <p className="mt-1 font-sans text-xs font-light text-black-forest/60">
                  {item.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
