import Link from "next/link";
import { Leaf, Globe2, RefreshCw, HeartHandshake, Trees, Sparkles } from "lucide-react";
import { AboutContent } from "@/types/admin";

const IconMap: Record<string, React.ElementType> = {
  Globe2,
  RefreshCw,
  HeartHandshake,
  Leaf,
  Trees,
  Sparkles
};

export default async function AboutPage() {
  let about: AboutContent | null = null;
  
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000'}/api/admin/about`, { 
      next: { revalidate: 300 } 
    });
    if (res.ok) {
      const data = await res.json();
      about = data.about || data; // Handle depending on exact API response shape
    }
  } catch (error) {
    console.error("Failed to fetch about content:", error);
  }

  // Fallback content if API fails
  if (!about || !about.mission) {
    about = {
      mission: {
        heading: "Our Mission",
        body: "<p>We believe that exploring nature shouldn't come at its expense. Indian Mist is dedicated to providing premium, sustainably sourced gear for the mindful adventurer.</p>"
      },
      drivesUs: {
        heading: "What Drives Us",
        cards: [
          { icon: "Globe2", title: "Global Impact", body: "We partner with communities worldwide to ensure fair trade practices." },
          { icon: "RefreshCw", title: "Circular Economy", body: "From recycled packaging to gear repair programs, we're committed to minimizing waste." },
          { icon: "HeartHandshake", title: "Community First", body: "We foster a community of outdoor enthusiasts who share our passion for adventure." }
        ]
      },
      cta: {
        heading: "Join the Movement",
        subtext: "Discover our collection of sustainable gear and start your next adventure with peace of mind.",
        primaryButtonLabel: "Shop Now",
        secondaryButtonLabel: "Our Story"
      }
    };
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="bg-cornsilk px-6 md:px-12 lg:px-16 py-20 md:py-28">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-12 h-12 rounded-full bg-warm border border-olive/20 flex items-center justify-center mx-auto mb-6">
            <Leaf size={20} className="text-olive" />
          </div>
          <h1 className="font-merriweather text-4xl md:text-5xl font-normal text-forest mb-6">
            {about.mission.heading}
          </h1>
          {/* Note: TipTap HTML output is sanitized by default on the client, but for Server Components injecting HTML, ensure the backend doesn't accept malicious inputs. */}
          <div 
            className="font-montserrat text-base font-light text-muted-text leading-relaxed max-w-lg mx-auto mt-4 prose prose-sm prose-olive text-center"
            dangerouslySetInnerHTML={{ __html: about.mission.body }} 
          />
        </div>
      </section>

      {/* Values Section */}
      <section className="bg-warm px-6 md:px-12 lg:px-16 py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-merriweather text-3xl font-normal text-forest text-center mb-2">{about.drivesUs.heading}</h2>
            <div className="w-12 h-px bg-forest mx-auto mt-3 mb-12" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {about.drivesUs.cards.map((card, i) => {
              const Icon = IconMap[card.icon] || Globe2;
              return (
                <div key={i} className="bg-card-surface border border-olive/10 rounded-md p-6 md:p-8 text-left hover:-translate-y-1 transition-transform">
                  <div className="w-10 h-10 flex items-center justify-center border border-olive/25 rounded-sm bg-warm mb-4">
                    <Icon size={20} className="text-olive" />
                  </div>
                  <h3 className="font-merriweather text-lg font-normal text-forest mb-3">{card.title}</h3>
                  <p className="font-montserrat text-sm font-light text-muted-text leading-relaxed">
                    {card.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-forest px-6 md:px-12 py-16 md:py-20">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-merriweather text-3xl md:text-4xl font-normal text-cornsilk">
            {about.cta.heading}
          </h2>
          <p className="font-montserrat text-sm font-light text-cornsilk/60 mt-4 leading-relaxed max-w-md mx-auto">
            {about.cta.subtext}
          </p>
          <div className="flex gap-3 justify-center mt-8 flex-wrap">
            {about.cta.primaryButtonLabel && (
              <Link href="/products" className="bg-clay text-cornsilk hover:bg-copper font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-3 rounded-sm transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                {about.cta.primaryButtonLabel}
              </Link>
            )}
            {about.cta.secondaryButtonLabel && (
              <Link href="/blogs" className="bg-transparent text-cornsilk/80 border border-cornsilk/25 hover:border-cornsilk/60 font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-3 rounded-sm transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                {about.cta.secondaryButtonLabel}
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
