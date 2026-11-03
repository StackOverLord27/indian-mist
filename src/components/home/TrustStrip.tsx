import { IconMap, type IconName } from "@/lib/icon-map";
import { formatPrice } from "@/lib/utils";

export interface TrustStripItemProps {
  icon: string;
  title: string;
  subtitle: string;
}

interface TrustStripProps {
  items?: TrustStripItemProps[];
  /**
   * The real free-shipping threshold from the pricing settings. A "Free shipping" point is added
   * to the strip from it (so the figure can never be out of date) unless the admin already
   * wrote one of their own. It never makes an otherwise empty strip appear.
   */
  freeShippingThreshold?: number;
}

export function TrustStrip({ items = [], freeShippingThreshold }: TrustStripProps) {
  // Only what the admin typed: an item with no text is not shown, and no items means no strip
  const written = (items ?? []).filter((i) => i.title?.trim() || i.subtitle?.trim());
  if (written.length === 0) return null;

  // The free-shipping point is a FACT the shop knows (the threshold in the pricing settings), so
  // it is always written from that: a figure typed by hand would go wrong the day the threshold
  // changes. An item titled "Free shipping" keeps the owner's wording and icon but gets the real figure.
  const freeShippingSubtitle = (): string | null =>
    freeShippingThreshold === undefined ? null : freeShippingThreshold > 0 ? `On orders above ${formatPrice(freeShippingThreshold)}` : "On every order";
  const isFreeShipping = (i: TrustStripItemProps) => /free\s+shipping/i.test(i.title ?? "");
  const withFacts = written.map((i) => (isFreeShipping(i) && freeShippingSubtitle() ? { ...i, subtitle: freeShippingSubtitle() as string } : i));

  // No free-shipping point of any kind written by the owner: add the real one
  const mentionsShipping = withFacts.some((i) => /shipping|delivery/i.test(`${i.title} ${i.subtitle}`));
  const displayItems: TrustStripItemProps[] =
    freeShippingThreshold && freeShippingThreshold > 0 && !mentionsShipping
      ? [{ icon: "Truck", title: "Free shipping", subtitle: freeShippingSubtitle() as string }, ...withFacts]
      : withFacts;

  return (
    <section className="bg-warm-mist">
      <div className="mx-auto max-w-screen-2xl overflow-x-auto sm:overflow-x-visible hide-scrollbar">
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
