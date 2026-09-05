import Link from "next/link";
import type { SiteSettings } from "@/types/admin";

// Custom SVG icons styled exactly like Lucide icons since lucide-react removed brand icons
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);
const FacebookIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
);
const TwitterIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
);
const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2.5 7.1C2 8.7 2 12 2 12s0 3.3.5 4.9c.3 1.1 1.2 2 2.3 2.2 3.6.4 7.2.4 7.2.4s3.6 0 7.2-.4c1.1-.2 2-.9 2.3-2.2.5-1.6.5-4.9.5-4.9s0-3.3-.5-4.9c-.3-1.1-1.2-2-2.3-2.2-3.6-.4-7.2-.4-7.2-.4s-3.6 0-7.2.4c-1.1.2-2 .9-2.3 2.2z"/><path d="m10 15 5-3-5-3z"/></svg>
);

const getSocialLinks = (settings?: SiteSettings): { label: string; icon: React.FC<{ className?: string }>; url: string }[] => {
  const links: { label: string; icon: React.FC<{ className?: string }>; url: string }[] = [];
  if (settings?.socialLinks?.instagram) {
    links.push({ label: "Instagram", icon: InstagramIcon, url: settings.socialLinks.instagram });
  }
  if (settings?.socialLinks?.facebook) {
    links.push({ label: "Facebook", icon: FacebookIcon, url: settings.socialLinks.facebook });
  }
  if (settings?.socialLinks?.twitter) {
    links.push({ label: "Twitter", icon: TwitterIcon, url: settings.socialLinks.twitter });
  }
  if (settings?.socialLinks?.youtube) {
    links.push({ label: "Youtube", icon: YoutubeIcon, url: settings.socialLinks.youtube });
  }
  return links;
};
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

export function Footer({ settings }: { settings?: SiteSettings }) {
  const activeSocialLinks = getSocialLinks(settings);
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
              {settings?.tagline || "Forest & Eco"}
            </span>
          </Link>
          <p className="mt-5 max-w-sm font-montserrat text-xs font-light leading-6 text-cornsilk/60">
            {settings?.footerNote || "Forest gear and eco-friendly goods made with slower materials, repairable details, and respect for the people who make them."}
          </p>
          <div className="mt-6 flex gap-3">
            {activeSocialLinks.map((social) => (
              <a
                key={social.label}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="flex size-9 items-center justify-center rounded-full border border-cornsilk/15 text-cornsilk/70 transition-opacity hover:opacity-75"
              >
                <social.icon className="size-4" />
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
