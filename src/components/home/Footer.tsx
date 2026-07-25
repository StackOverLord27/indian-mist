import Link from "next/link";
import { Camera, CirclePlay, MessageCircle, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const socialLinks: {
  label: string;
  icon: LucideIcon;
}[] = [
  { label: "Instagram", icon: Camera },
  { label: "Facebook", icon: MessageCircle },
  { label: "Twitter", icon: Send },
  { label: "Youtube", icon: CirclePlay },
];

const footerColumns = [
  {
    title: "Shop",
    links: ["Forest gear", "Apparel", "Pins", "Stationery"],
  },
  {
    title: "Company",
    links: ["About", "Journal", "Sourcing", "Careers"],
  },
  {
    title: "Support",
    links: ["Contact", "Shipping", "Returns", "Care guide"],
  },
];

const certifications = ["Eco certified", "Carbon neutral", "Fair trade"];

export function Footer() {
  return (
    <footer className="bg-forest px-6 pb-7 pt-13 md:px-12">
      {/* Top grid — brand + nav columns */}
      <div className="grid grid-cols-2 gap-10 md:grid-cols-4 lg:grid-cols-5">
        {/* Brand block — full-width on mobile, 1 col on md, 2 cols on lg */}
        <div className="col-span-2 md:col-span-1 lg:col-span-2">
          <Link href="/" aria-label="Indian Mist home">
            <span className="block font-merriweather text-2xl font-bold text-cornsilk">
              Indian Mist
            </span>
            <span className="mt-1 block font-montserrat text-[9px] font-medium uppercase tracking-widest text-clay">
              Forest &amp; Eco
            </span>
          </Link>
          <p className="mt-5 max-w-sm font-montserrat text-xs font-light leading-6 text-cornsilk/60">
            Forest gear and eco-friendly goods made with slower materials,
            repairable details, and respect for the people who make them.
          </p>
          <div className="mt-6 flex gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href="#"
                aria-label={social.label}
                className="flex size-9 items-center justify-center rounded-full border border-cornsilk/15 text-cornsilk/70 transition-opacity hover:opacity-75"
              >
                <social.icon className="size-4" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        {/* Nav columns — each 1 col */}
        {footerColumns.map((column) => (
          <div key={column.title} className="col-span-1">
            <h2 className="font-montserrat text-[10px] font-medium uppercase tracking-widest text-clay">
              {column.title}
            </h2>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    className="font-montserrat text-xs font-light text-cornsilk/60 transition-opacity hover:opacity-80"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="mt-12 flex flex-col items-center justify-between gap-5 border-t border-cornsilk/10 pt-6 text-center md:flex-row md:text-left">
        <p className="font-montserrat text-xs font-light text-cornsilk/50">
          © 2026 Indian Mist. All rights reserved.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {certifications.map((certification) => (
            <span
              key={certification}
              className="rounded-full border border-cornsilk/15 px-3 py-1 font-montserrat text-[9px] font-medium uppercase tracking-widest text-cornsilk/55"
            >
              {certification}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
