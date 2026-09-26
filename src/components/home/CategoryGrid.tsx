import { ImageSlot } from "@/components/home/ImageSlot";
import type { Category } from "@/lib/homepage-data";

type CategoryGridProps = {
  categories: Category[];
};

export function CategoryGrid({ categories }: CategoryGridProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <section className="bg-cornsilk px-6 py-16 md:px-12">
      <div className="mb-8">
        <h2 className="font-serif text-2xl font-light text-black-forest md:text-3xl">
          Shop by category
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </section>
  );
}

function CategoryCard({ category }: { category: Category }) {
  return (
    <article
      className={
        category.featured
          ? "group relative min-h-80 overflow-hidden rounded-home-card md:col-span-2"
          : "group relative min-h-80 overflow-hidden rounded-home-card"
      }
    >
      <ImageSlot
        image={category.image}
        sizes={
          category.featured
            ? "(max-width: 768px) 100vw, 66vw"
            : "(max-width: 768px) 100vw, 33vw"
        }
        imageClassName="transition-transform group-hover:scale-1015"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black-forest/80 via-black-forest/20 to-transparent" />
      <div className="absolute bottom-5 left-5 right-5">
        <h3 className="font-serif text-lg font-normal text-white">
          {category.name}
        </h3>
        <p className="mt-1 font-sans text-xs font-light text-white/60">
          {category.productCount}
        </p>
      </div>
    </article>
  );
}
