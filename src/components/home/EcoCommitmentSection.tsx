import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface EcoStat {
  icon: string;
  number: string;
  label: string;
  description: string;
}

export interface EcoCommitmentSettings {
  subtitle?: string;
  titleLine1?: string;
  titleLine2?: string;
  items?: EcoStat[];
}

interface EcoCommitmentProps {
  settings?: EcoCommitmentSettings;
}

const defaultStats: EcoStat[] = [
  {
    icon: "TreePine",
    number: "12k+",
    label: "Trees planted",
    description: "Native saplings funded through every order.",
  },
  {
    icon: "Recycle",
    number: "100%",
    label: "Recycled packaging",
    description: "Mailers, tags, and inserts made to be reused.",
  },
  {
    icon: "PackageCheck",
    number: "0",
    label: "Plastic used",
    description: "Plastic-free shipping across our core catalog.",
  },
  {
    icon: "HandHeart",
    number: "1%",
    label: "Revenue donated",
    description: "Annual giving toward rewilding and maker welfare.",
  },
];

export function EcoCommitmentSection({ settings }: EcoCommitmentProps) {
  const subtitle = settings?.subtitle ?? "Our commitment";
  const titleLine1 = settings?.titleLine1 ?? "Every order shapes a gentler ";
  const titleLine2 = settings?.titleLine2 ?? "future.";
  const displayItems = settings?.items && settings.items.length > 0 ? settings.items : defaultStats;

  return (
    <section className="bg-black-forest px-6 py-16 md:px-12">
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-sans text-2xs font-medium uppercase tracking-widest text-sunlit-clay">
          {subtitle}
        </p>
        <h2 className="mt-4 font-serif text-3xl font-light leading-tight text-cornsilk">
          {titleLine1}
          <em className="font-light italic text-sunlit-clay">{titleLine2}</em>
        </h2>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {displayItems.map((stat, index) => {
          const IconComponent = (Icons as any)[stat.icon] as LucideIcon || Icons.TreePine;
          
          return (
            <article
              key={index}
              className="rounded-home-card border border-cornsilk/10 px-5 py-8 text-center"
            >
              <IconComponent className="mx-auto size-7 text-sunlit-clay" aria-hidden="true" />
              <p className="mt-5 font-serif text-4xl font-bold leading-none text-sunlit-clay">
                {stat.number}
              </p>
              <h3 className="mt-3 font-sans text-xs font-medium uppercase tracking-wide text-cornsilk">
                {stat.label}
              </h3>
              <p className="mt-2 font-sans text-xs font-light leading-5 text-cornsilk/55">
                {stat.description}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
