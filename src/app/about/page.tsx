import Link from "next/link";
import { Leaf, Globe2, RefreshCw, HeartHandshake } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="bg-cornsilk px-6 md:px-12 lg:px-16 py-20 md:py-28">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-12 h-12 rounded-full bg-warm border border-olive/20 flex items-center justify-center mx-auto mb-6">
            <Leaf size={20} className="text-olive" />
          </div>
          <h1 className="font-merriweather text-4xl md:text-5xl font-normal text-forest mb-6">
            Our Mission
          </h1>
          <p className="font-montserrat text-base font-light text-muted-text leading-relaxed max-w-lg mx-auto mt-4">
            We believe that exploring nature shouldn&apos;t come at its expense. 
            Indian Mist is dedicated to providing premium, sustainably sourced gear for the mindful adventurer.
          </p>
        </div>
      </section>

      {/* Values Section */}
      <section className="bg-warm px-6 md:px-12 lg:px-16 py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-merriweather text-3xl font-normal text-forest text-center mb-2">What Drives Us</h2>
            <div className="w-12 h-px bg-forest mx-auto mt-3 mb-12" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Value 1 */}
            <div className="bg-card-surface border border-olive/10 rounded-md p-6 md:p-8 text-left hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 flex items-center justify-center border border-olive/25 rounded-sm bg-warm mb-4">
                <Globe2 size={20} className="text-olive" />
              </div>
              <h3 className="font-merriweather text-lg font-normal text-forest mb-3">Global Impact</h3>
              <p className="font-montserrat text-sm font-light text-muted-text leading-relaxed">
                We partner with communities worldwide to ensure fair trade practices and support local economies while sourcing the finest materials.
              </p>
            </div>

            {/* Value 2 */}
            <div className="bg-card-surface border border-olive/10 rounded-md p-6 md:p-8 text-left hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 flex items-center justify-center border border-olive/25 rounded-sm bg-warm mb-4">
                <RefreshCw size={20} className="text-olive" />
              </div>
              <h3 className="font-merriweather text-lg font-normal text-forest mb-3">Circular Economy</h3>
              <p className="font-montserrat text-sm font-light text-muted-text leading-relaxed">
                From recycled packaging to gear repair programs, we&apos;re committed to minimizing waste and extending the lifecycle of our products.
              </p>
            </div>

            {/* Value 3 */}
            <div className="bg-card-surface border border-olive/10 rounded-md p-6 md:p-8 text-left hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 flex items-center justify-center border border-olive/25 rounded-sm bg-warm mb-4">
                <HeartHandshake size={20} className="text-olive" />
              </div>
              <h3 className="font-merriweather text-lg font-normal text-forest mb-3">Community First</h3>
              <p className="font-montserrat text-sm font-light text-muted-text leading-relaxed">
                We foster a community of outdoor enthusiasts who share our passion for adventure, conservation, and leaving no trace.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-forest px-6 md:px-12 py-16 md:py-20">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-merriweather text-3xl md:text-4xl font-normal text-cornsilk">
            Join the <span className="italic">Movement</span>
          </h2>
          <p className="font-montserrat text-sm font-light text-cornsilk/60 mt-4 leading-relaxed max-w-md mx-auto">
            Discover our collection of sustainable gear and start your next adventure with peace of mind.
          </p>
          <div className="flex gap-3 justify-center mt-8 flex-wrap">
            <Link href="/products" className="bg-clay text-cornsilk hover:bg-copper font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-3 rounded-sm transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
              Shop Now
            </Link>
            <Link href="/blogs" className="bg-transparent text-cornsilk/80 border border-cornsilk/25 hover:border-cornsilk/60 font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-3 rounded-sm transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
              Our Story
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
