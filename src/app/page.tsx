import { HeroCarousel } from "@/components/home/HeroCarousel";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-start w-full">
      <HeroCarousel />
      
      {/* Categories Section Preview */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center space-y-4 mb-16 animate-in slide-in-from-bottom-4 duration-700">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">Explore Our Categories</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find the perfect gear for your next adventure. All our products are sustainably sourced and crafted with love for the environment.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {[
            { title: "Tents & Shelters", icon: "🏕️" },
            { title: "Eco Backpacks", icon: "🎒" },
            { title: "Sustainable Apparel", icon: "🧥" },
          ].map((cat) => (
            <div key={cat.title} className="group relative rounded-2xl overflow-hidden border border-border bg-card p-10 hover:shadow-xl hover:border-primary/50 transition-all duration-300 hover:-translate-y-2 cursor-pointer flex flex-col items-center text-center gap-6">
              <div className="text-7xl group-hover:scale-110 transition-transform duration-500">
                {cat.icon}
              </div>
              <h3 className="text-2xl font-semibold text-card-foreground group-hover:text-primary transition-colors">{cat.title}</h3>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
