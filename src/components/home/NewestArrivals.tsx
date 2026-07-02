import { ImageSlot } from "@/components/home/ImageSlot";
import type { Arrival } from "@/lib/homepage-data";

type NewestArrivalsProps = {
  arrivals: Arrival[];
};

export function NewestArrivals({ arrivals }: NewestArrivalsProps) {
  return (
    <section className="bg-warm-mist px-6 py-16 md:px-12">
      <div className="mb-8">
        <h2 className="font-serif text-2xl font-light text-black-forest md:text-3xl">
          Newest arrivals
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {arrivals.map((arrival) => (
          <ArrivalCard key={arrival.id} arrival={arrival} />
        ))}
      </div>
    </section>
  );
}

function ArrivalCard({ arrival }: { arrival: Arrival }) {
  return (
    <article className="rounded-home-card border border-olive-leaf/10 bg-cornsilk p-3">
      <div
        className="relative overflow-hidden rounded-home-card"
        style={{ aspectRatio: "4 / 3" }}
      >
        <ImageSlot
          image={arrival.image}
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      </div>

      <div className="p-2 pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-sans text-2xs font-medium uppercase tracking-widest text-olive-leaf">
            {arrival.category}
          </p>
          <span className="rounded-full bg-warm-mist px-3 py-1 font-sans text-3xs font-medium uppercase tracking-widest text-copperwood">
            Just in
          </span>
        </div>
        <h3 className="mt-3 font-serif text-base font-normal text-black-forest">
          {arrival.name}
        </h3>
        <p className="mt-2 font-sans text-xs font-light leading-5 text-black-forest/65">
          {arrival.description}
        </p>
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="font-serif text-xl font-bold text-black-forest">
            {arrival.price}
          </p>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-full bg-olive-leaf px-5 font-sans text-xs font-medium uppercase tracking-wide text-cornsilk transition-opacity hover:opacity-85"
          >
            Add to bag
          </button>
        </div>
      </div>
    </article>
  );
}
