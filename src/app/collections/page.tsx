import dbConnect from "@/lib/db";
import { Collection } from "@/models/collection.model";
import { ProductCard } from "@/components/home/ProductCard";
import { toCardProduct, type PopulatedCollection } from "@/lib/collection-products";
import { Product as ProductModel } from "@/models/product.model";

export const revalidate = 0; // Prevent caching for now if we want fresh data

export default async function CollectionsPage() {
  await dbConnect();

  // Ensure Product model is registered before populating
  ProductModel.init();

  const collections = await Collection.find({ isActive: true })
    .populate("products")
    .sort({ order: 1, createdAt: 1 })
    .lean<PopulatedCollection[]>();

  return (
    <div className="bg-cornsilk px-4 sm:px-6 md:px-12 lg:px-16 pt-12 pb-16 min-h-screen page-enter">
      {/* Page header with a thin green accent */}
      <header className="mb-14 pb-8 border-b border-olive/20">
        <div className="space-y-2 max-w-prose">
          <h1 className="font-merriweather text-3xl md:text-4xl font-normal text-forest">
            Curated Collections
          </h1>
          <p className="font-montserrat text-sm font-light text-muted-text mt-2">
            Discover items grouped by causes and themes. Thoughtfully put
            together for your journey.
          </p>
        </div>
      </header>

      {collections.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-merriweather text-xl text-forest mb-2">
            No collections found
          </p>
          <p className="font-montserrat text-sm text-muted-text">
            Check back later for curated collections.
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {collections.map((collection, index) => {
            if (!collection.products || collection.products.length === 0)
              return null;

            const isEven = index % 2 === 0;

            return (
              <section
                key={collection._id.toString()}
                className={`py-12 ${isEven ? "" : "bg-warm-mist/40"} -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-12 md:px-12 lg:-mx-16 lg:px-16`}
              >
                <div className="mb-6 flex items-baseline gap-4">
                  {/* Faint index number in forest green */}
                  <span className="font-merriweather text-5xl font-normal text-forest/10 select-none leading-none">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2 className="font-merriweather text-xl md:text-2xl font-normal text-forest mb-1">
                      {collection.name}
                    </h2>
                    {collection.description && (
                      <p className="font-montserrat text-sm font-light text-forest/80 max-w-prose leading-relaxed">
                        {collection.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
                  {collection.products.filter((p) => p !== null).map((p) => (
                    <ProductCard key={p._id.toString()} product={toCardProduct(p)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
