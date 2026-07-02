import { Award, Leaf, Recycle, ShieldCheck, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const trustItems: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}[] = [
  {
    icon: Truck,
    title: "Free shipping",
    subtitle: "Above ₹999",
  },
  {
    icon: Leaf,
    title: "1 tree per order",
    subtitle: "Planted with care",
  },
  {
    icon: Recycle,
    title: "Sustainable materials",
    subtitle: "Low-impact goods",
  },
  {
    icon: ShieldCheck,
    title: "Easy returns",
    subtitle: "Simple exchanges",
  },
  {
    icon: Award,
    title: "Ethically sourced",
    subtitle: "Traceable makers",
  },
];

export function TrustStrip() {
  return (
    <section className="bg-warm-mist">
      <div className="grid grid-cols-1 divide-y divide-olive-leaf/20 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
        {trustItems.map((item) => (
          <div
            key={item.title}
            className="flex items-center gap-3 px-6 py-5 md:justify-center"
          >
            <item.icon className="size-5 shrink-0 text-olive-leaf" aria-hidden="true" />
            <div>
              <h2 className="font-sans text-xs font-semibold text-black-forest">
                {item.title}
              </h2>
              <p className="mt-1 font-sans text-xs font-light text-black-forest/60">
                {item.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
