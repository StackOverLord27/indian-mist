import { HandHeart, PackageCheck, Recycle, TreePine } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const stats: {
  icon: LucideIcon;
  number: string;
  label: string;
  description: string;
}[] = [
  {
    icon: TreePine,
    number: "12k+",
    label: "Trees planted",
    description: "Native saplings funded through every order.",
  },
  {
    icon: Recycle,
    number: "100%",
    label: "Recycled packaging",
    description: "Mailers, tags, and inserts made to be reused.",
  },
  {
    icon: PackageCheck,
    number: "0",
    label: "Plastic used",
    description: "Plastic-free shipping across our core catalog.",
  },
  {
    icon: HandHeart,
    number: "1%",
    label: "Revenue donated",
    description: "Annual giving toward rewilding and maker welfare.",
  },
];

export function EcoCommitmentSection() {
  return (
    <section className="bg-black-forest px-6 py-16 md:px-12">
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-sans text-2xs font-medium uppercase tracking-widest text-sunlit-clay">
          Our commitment
        </p>
        <h2 className="mt-4 font-serif text-3xl font-light leading-tight text-cornsilk">
          Every order shapes a gentler{" "}
          <em className="font-light italic text-sunlit-clay">future.</em>
        </h2>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-home-card border border-cornsilk/10 px-5 py-8 text-center"
          >
            <stat.icon className="mx-auto size-7 text-sunlit-clay" aria-hidden="true" />
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
        ))}
      </div>
    </section>
  );
}
