import Link from "next/link";
import { ImageSlot } from "@/components/home/ImageSlot";
import type { Category } from "@/lib/homepage-data";

type CategoryGridProps = {
  categories: Category[];
};

export function CategoryGrid({ categories }: CategoryGridProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <section className="bg-cornsilk px-6 py-16 md:px-12">
      <div className="mx-auto max-w-screen-2xl">
        <div className="mb-8">
          <h2 className="font-serif text-2xl font-light text-black-forest md:text-3xl">
            Shop by category
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={`/products?category=${category.id}`}
      className={
        category.featured
          ? "group relative aspect-[2.05/1] overflow-hidden rounded-home-card col-span-2 block"
          : "group relative aspect-square overflow-hidden rounded-home-card block"
      }
    >
      <ImageSlot
        image={category.image}
        sizes={
          category.featured
            ? "(max-width: 768px) 100vw, 66vw"
            : "(max-width: 768px) 50vw, 33vw"
        }
        imageClassName="transition-transform group-hover:scale-1015"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black-forest/80 via-black-forest/20 to-transparent" />
      <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5">
        <h3 className="font-serif text-sm sm:text-lg font-normal text-white">
          {category.name}
        </h3>
        <p className="mt-1 font-sans text-2xs sm:text-xs font-light text-white/60">
          {category.productCount}
        </p>
      </div>
    </Link>
  );
}
