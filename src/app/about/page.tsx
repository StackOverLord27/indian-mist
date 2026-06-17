import Link from "next/link";
import { Leaf, Globe, Recycle, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary/5 py-24 md:py-32">
        <div className="absolute inset-0 bg-grid-black/[0.02] bg-[size:20px_20px]" />
        <div className="container relative mx-auto px-4 z-10 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-6">
            <Leaf className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6">
            Our <span className="text-primary">Mission</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            We believe that exploring nature shouldn't come at its expense. 
            Indian Mist is dedicated to providing premium, sustainably sourced gear for the mindful adventurer.
          </p>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">What Drives Us</h2>
            <div className="w-24 h-1 bg-primary mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            {/* Value 1 */}
            <div className="flex flex-col items-center text-center p-8 rounded-3xl bg-secondary/30 hover:bg-secondary/50 transition-colors border border-border/50">
              <div className="h-16 w-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-6 -rotate-6 hover:rotate-0 transition-transform">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Global Impact</h3>
              <p className="text-muted-foreground leading-relaxed">
                We partner with communities worldwide to ensure fair trade practices and support local economies while sourcing the finest materials.
              </p>
            </div>

            {/* Value 2 */}
            <div className="flex flex-col items-center text-center p-8 rounded-3xl bg-secondary/30 hover:bg-secondary/50 transition-colors border border-border/50 mt-0 md:mt-12">
              <div className="h-16 w-16 bg-green-500/20 rounded-2xl flex items-center justify-center mb-6 rotate-6 hover:rotate-0 transition-transform">
                <Recycle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Circular Economy</h3>
              <p className="text-muted-foreground leading-relaxed">
                From recycled packaging to gear repair programs, we're committed to minimizing waste and extending the lifecycle of our products.
              </p>
            </div>

            {/* Value 3 */}
            <div className="flex flex-col items-center text-center p-8 rounded-3xl bg-secondary/30 hover:bg-secondary/50 transition-colors border border-border/50">
              <div className="h-16 w-16 bg-rose-500/20 rounded-2xl flex items-center justify-center mb-6 -rotate-6 hover:rotate-0 transition-transform">
                <Heart className="h-8 w-8 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Community First</h3>
              <p className="text-muted-foreground leading-relaxed">
                We foster a community of outdoor enthusiasts who share our passion for adventure, conservation, and leaving no trace.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-foreground text-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">Join the Movement</h2>
          <p className="text-xl text-background/80 max-w-2xl mx-auto mb-10">
            Discover our collection of sustainable gear and start your next adventure with peace of mind.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/products">
              <Button size="lg" className="rounded-full px-8 text-lg bg-primary text-primary-foreground hover:bg-primary/90">
                Shop Now
              </Button>
            </Link>
            <Link href="/blogs">
              <Button size="lg" variant="outline" className="rounded-full px-8 text-lg border-background/20 text-background hover:bg-background/10">
                Read our Story
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
