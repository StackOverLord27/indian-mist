"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SiteSettings } from "@/types/admin";
import {
  FaInstagram,
  FaFacebook,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";

const getSocialLinks = (
  settings?: SiteSettings,
): { label: string; icon: React.FC<{ className?: string }>; url: string }[] => {
  const links: {
    label: string;
    icon: React.FC<{ className?: string }>;
    url: string;
  }[] = [];
  if (settings?.socialLinks?.instagram) {
    links.push({
      label: "Instagram",
      icon: FaInstagram,
      url: settings.socialLinks.instagram,
    });
  }
  if (settings?.socialLinks?.facebook) {
    links.push({
      label: "Facebook",
      icon: FaFacebook,
      url: settings.socialLinks.facebook,
    });
  }
  if (settings?.socialLinks?.twitter) {
    links.push({
      label: "Twitter",
      icon: FaXTwitter,
      url: settings.socialLinks.twitter,
    });
  }
  if (settings?.socialLinks?.youtube) {
    links.push({
      label: "Youtube",
      icon: FaYoutube,
      url: settings.socialLinks.youtube,
    });
  }
  return links;
};

type NavItem = { name: string; slug: string };

function buildFooterColumns(categories: NavItem[], collections: NavItem[]) {
  const shopLinks = [
    { label: "All Products", href: "/products" },
    ...categories.map((c) => ({
      label: c.name,
      href: `/products?category=${c.slug}`,
    })),
  ];

  const collectionsLinks =
    collections.length > 0
      ? [
          { label: "All Collections", href: "/collections" },
          ...collections.map((c) => ({
            label: c.name,
            href: `/collections/${c.slug}`,
          })),
        ]
      : [];

  return [
    { title: "Shop", links: shopLinks },
    ...(collectionsLinks.length > 0
      ? [{ title: "Collections", links: collectionsLinks }]
      : []),
    {
      title: "Company",
      links: [
        { label: "About Us", href: "/about" },
        { label: "Journal", href: "/blogs" },
        { label: "Contact Us", href: "/contact" },
      ],
    },
    {
      title: "Account",
      links: [
        { label: "My Profile & Orders", href: "/profile" },
        { label: "Shopping Bag", href: "/cart" },
        { label: "Wishlist", href: "/wishlist" },
      ],
    },
  ];
}

// Eco certified & Fair trade only (Carbon neutral removed)
const certifications = ["Made in India"];

export function Footer({
  settings,
  categories = [],
  collections = [],
}: {
  settings?: SiteSettings;
  categories?: NavItem[];
  collections?: NavItem[];
}) {
  const pathname = usePathname();

  // Hide footer on all admin pages
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const activeSocialLinks = getSocialLinks(settings);
  const footerColumns = buildFooterColumns(categories, collections);

  return (
    <footer className="bg-forest px-6 pb-7 pt-13 md:px-12">
      <div className="mx-auto max-w-screen-2xl">
        {/* Top grid — brand + nav columns */}
        <div
          className={`grid grid-cols-2 gap-10 ${footerColumns.length > 3 ? "md:grid-cols-4 lg:grid-cols-6" : "md:grid-cols-4 lg:grid-cols-5"}`}
        >
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
            <p className="mt-5 max-w-sm font-montserrat text-xs font-light leading-6 text-cornsilk/75">
              {settings?.footerNote ||
                "Forest gear and eco-friendly goods made with slower materials, repairable details, and respect for the people who make them."}
            </p>
            {activeSocialLinks.length > 0 && (
              <div className="mt-6 flex gap-3">
                {activeSocialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="flex size-9 items-center justify-center rounded-full border border-cornsilk/15 text-cornsilk/80 transition-opacity hover:opacity-75"
                  >
                    <social.icon className="size-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Nav columns */}
          {footerColumns.map((column) => (
            <div key={column.title} className="col-span-1">
              <h2 className="font-montserrat text-[10px] font-medium uppercase tracking-widest text-clay">
                {column.title}
              </h2>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-montserrat text-xs font-light text-cornsilk/75 transition-colors hover:text-cornsilk hover:opacity-100"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center gap-5 border-t border-cornsilk/10 pt-6 text-center md:grid md:grid-cols-3 md:items-center md:text-left">
          <p className="font-montserrat text-xs font-light text-cornsilk/70">
            © 2026 Indian Mist. All rights reserved.
          </p>
          <div className="flex justify-center gap-6">
            <Link
              href="/privacy-policy"
              className="font-montserrat text-[10px] font-medium uppercase tracking-widest text-cornsilk/75 transition-colors hover:text-cornsilk"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms-and-conditions"
              className="font-montserrat text-[10px] font-medium uppercase tracking-widest text-cornsilk/75 transition-colors hover:text-cornsilk"
            >
              Terms &amp; Conditions
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-2 md:justify-end">
            {certifications.map((certification) => (
              <span
                key={certification}
                className="rounded-full border border-cornsilk/15 px-3 py-1 font-montserrat text-[9px] font-medium uppercase tracking-widest text-cornsilk/75"
              >
                {certification}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
