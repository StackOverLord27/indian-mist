"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Heart, Search, ShoppingBag, User } from "lucide-react";

const navLinks = [
  { name: "Home", href: "/", active: true },
  { name: "Products", href: "/products" },
  { name: "Collections", href: "/collections" },
  { name: "About", href: "/about" },
  { name: "Blogs", href: "/blogs" },
];

export function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <nav className={`sticky z-40 h-16 w-full border-b border-olive-leaf/15 bg-cornsilk ${isHome ? 'top-7' : 'top-0'}`}>
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 md:px-12">
        <Link href="/" className="shrink-0 flex items-center h-full max-w-[140px] md:max-w-[180px]" aria-label="Indian Mist home">
          <Image
            src="/InCollage_20260513_093524159.png"
            alt="Indian Mist Logo"
            width={180}
            height={64}
            style={{ width: "auto", height: "100%", objectFit: "contain" }}
            className="object-contain"
            priority
          />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={
                link.active
                  ? "font-sans text-xs font-medium uppercase tracking-widest text-olive-leaf"
                  : "font-sans text-xs font-medium uppercase tracking-widest text-black-forest/75 transition-opacity hover:opacity-100"
              }
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <label className="hidden h-9 w-56 items-center gap-2 rounded-full border border-olive-leaf bg-warm-mist px-4 lg:flex">
            <Search className="size-4 text-olive-leaf" aria-hidden="true" />
            <span className="sr-only">Search products</span>
            <input
              type="search"
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent font-sans text-xs text-black-forest outline-none placeholder:text-olive-leaf/60"
            />
          </label>

          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full text-black-forest transition-opacity hover:opacity-70"
            aria-label="Open wishlist"
          >
            <Heart className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="relative flex size-9 items-center justify-center rounded-full text-black-forest transition-opacity hover:opacity-70"
            aria-label="Open shopping bag"
          >
            <ShoppingBag className="size-5" aria-hidden="true" />
            <span className="absolute -right-1 top-0 flex size-4 items-center justify-center rounded-full bg-copperwood font-sans text-3xs font-medium text-cornsilk">
              2
            </span>
          </button>
          <button
            type="button"
            className="hidden size-9 items-center justify-center rounded-full text-black-forest transition-opacity hover:opacity-70 sm:flex"
            aria-label="Open account"
          >
            <User className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  );
}
