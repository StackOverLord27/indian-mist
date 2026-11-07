import { IconMap, type IconName } from "@/lib/icon-map";

export interface TrustStripItemProps {
  icon: string;
  title: string;
  subtitle: string;
}

interface TrustStripProps {
  items?: TrustStripItemProps[];
}

export function TrustStrip({ items = [] }: TrustStripProps) {
  // Exactly what the admin typed and nothing else: an item with no text is not shown, and no
  // items means no strip. Nothing is added or rewritten from other settings.
  const displayItems = (items ?? []).filter((i) => i.title?.trim() || i.subtitle?.trim());
  if (displayItems.length === 0) return null;

  return (
    <section className="bg-warm-mist">
      <div className="mx-auto w-full max-w-7xl overflow-x-auto sm:overflow-x-visible hide-scrollbar">
        <div className="flex min-w-max sm:min-w-0 sm:flex-wrap sm:justify-center divide-x divide-olive-leaf/20">
          {displayItems.map((item, index) => {
            const IconComponent = IconMap[item.icon as IconName] || IconMap.Leaf;

            return (
              <div
                key={index}
                className="flex items-center gap-2.5 px-5 py-4 sm:px-6 sm:py-5 sm:flex-1 sm:min-w-[180px] sm:max-w-sm sm:justify-center whitespace-nowrap sm:whitespace-normal"
              >
                <IconComponent className="size-4 sm:size-5 shrink-0 text-olive-leaf" aria-hidden="true" />
                <div>
                  <h2 className="font-sans text-[11px] sm:text-xs font-semibold text-black-forest">
                    {item.title}
                  </h2>
                  <p className="mt-0.5 font-sans text-[10px] sm:text-xs font-light text-black-forest/75">
                    {item.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
