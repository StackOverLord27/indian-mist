import { IconMap, type IconName } from "@/lib/icon-map";

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

export function EcoCommitmentSection({ settings }: EcoCommitmentProps) {
  // Only figures and promises the admin typed are shown. No items means no section.
  const items = (settings?.items ?? []).filter((i) => i.number?.trim() || i.label?.trim() || i.description?.trim());
  if (items.length === 0) return null;

  const subtitle = settings?.subtitle?.trim() ?? "";
  const titleLine1 = settings?.titleLine1 ?? "";
  const titleLine2 = settings?.titleLine2 ?? "";
  const hasHeading = Boolean(titleLine1.trim() || titleLine2.trim());

  return (
    <section className="bg-black-forest py-16">
      <div className="mx-auto w-full max-w-page px-4 sm:px-6 md:px-10 lg:px-16">
      {(subtitle || hasHeading) && (
        <div className="mx-auto max-w-3xl text-center">
          {subtitle && (
            <p className="font-sans text-2xs font-medium uppercase tracking-widest text-sunlit-clay">
              {subtitle}
            </p>
          )}
          {hasHeading && (
            <h2 className="mt-4 font-serif text-3xl font-light leading-tight text-cornsilk">
              {titleLine1}
              {titleLine2 && <em className="font-light italic text-sunlit-clay">{titleLine2}</em>}
            </h2>
          )}
        </div>
      )}

      <div className={`${subtitle || hasHeading ? "mt-10" : ""} grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`}>
        {items.map((stat, index) => {
          const IconComponent = IconMap[stat.icon as IconName] || IconMap.TreePine;
          
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
              <p className="mt-2 font-sans text-xs font-light leading-5 text-cornsilk/75">
                {stat.description}
              </p>
            </article>
          );
        })}
      </div>
      </div>
    </section>
  );
}
