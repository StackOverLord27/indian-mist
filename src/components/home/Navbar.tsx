"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import {
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useWishlistStore } from "@/lib/wishlist-store";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// ─── Nav link definitions ────────────────────────────────────────────────────

type NavChild = { name: string; href: string };

type NavLink = {
  name: string;
  href: string;
  children?: NavChild[];
};

const navLinks: NavLink[] = [
  { name: "Home", href: "/" },
  {
    name: "Products",
    href: "/products",
    children: [
      { name: "Forest Gear", href: "/products?category=forest-gear" },
      { name: "Apparel", href: "/products?category=apparel" },
      { name: "Pins & Patches", href: "/products?category=pins" },
      { name: "Stationery", href: "/products?category=stationery" },
    ],
  },
  {
    name: "Collections",
    href: "/collections",
    children: [
      { name: "Summer 2026", href: "/collections/summer-2026" },
      { name: "Monsoon Edit", href: "/collections/monsoon-edit" },
    ],
  },
  { name: "About", href: "/about" },
  { name: "Blogs", href: "/blogs" },
];

// ─── Desktop nav link ────────────────────────────────────────────────────────

function DesktopNavLink({
  link,
  isActive,
}: {
  link: NavLink;
  isActive: boolean;
}) {
  return (
    <Link
      href={link.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "font-sans text-xs font-medium uppercase tracking-widest transition-all",
        isActive
          ? "text-olive-leaf underline underline-offset-8 decoration-2 decoration-olive-leaf"
          : "text-black-forest/75 hover:opacity-100 hover:text-black-forest"
      )}
    >
      {link.name}
    </Link>
  );
}

// ─── Mobile accordion nav item ───────────────────────────────────────────────

function MobileNavItem({
  link,
  isActive,
  onClose,
}: {
  link: NavLink;
  isActive: boolean;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = Boolean(link.children?.length);

  const linkClass = cn(
    "flex w-full items-center px-5 py-3.5 font-sans text-sm font-medium uppercase tracking-widest transition-colors",
    isActive
      ? "text-olive-leaf"
      : "text-black-forest/80 hover:text-black-forest"
  );

  if (!hasChildren) {
    return (
      <Link href={link.href} onClick={onClose} className={linkClass}>
        {link.name}
      </Link>
    );
  }

  return (
    <div>
      {/* Accordion trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between px-5 py-3.5 font-sans text-sm font-medium uppercase tracking-widest transition-colors",
          isActive
            ? "text-olive-leaf"
            : "text-black-forest/80 hover:text-black-forest"
        )}
      >
        <span>{link.name}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-olive-leaf/70 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {/* Accordion body — CSS max-height transition */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <ul className="mb-1 ml-5 border-l-2 border-olive-leaf/20">
          {/* "All X" shortcut */}
          <li>
            <Link
              href={link.href}
              onClick={onClose}
              className="flex w-full items-center gap-2 px-4 py-2.5 font-sans text-xs font-medium uppercase tracking-widest text-olive-leaf transition-colors hover:text-black-forest"
            >
              All {link.name}
            </Link>
          </li>

          {link.children!.map((child) => (
            <li key={child.name}>
              <Link
                href={child.href}
                onClick={onClose}
                className="flex w-full items-center gap-2 px-4 py-2.5 font-sans text-xs font-light tracking-wide text-black-forest/70 transition-colors hover:text-black-forest"
              >
                {child.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Main Navbar ─────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname = usePathname();

  // Hide storefront navbar on admin pages
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const isHome = pathname === "/";
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const wishlistCount = useWishlistStore((s) => s.items.length);

  // Controlled open state so we can close the sheet programmatically
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const handleOpenChange = useCallback(
    (open: boolean) => setMobileOpen(open),
    []
  );

  return (
    <nav
      className={`sticky z-40 h-16 w-full border-b border-olive-leaf/15 bg-cornsilk ${isHome ? "top-8 sm:top-7" : "top-0"}`}
    >
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 md:px-12">
        {/* ── Logo ── */}
        <Link
          href="/"
          className="flex h-full max-w-[140px] shrink-0 items-center md:max-w-[180px]"
          aria-label="Indian Mist home"
        >
          <Image
            src="/InCollage_20260513_093524159.png"
            alt="Indian Mist Logo"
            width={64}
            height={64}
            className="h-12 w-12 md:h-14 md:w-14 object-contain"
            priority
          />
        </Link>

        {/* ── Desktop nav links (md+) ── */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <DesktopNavLink
              key={link.name}
              link={link}
              isActive={
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href)
              }
            />
          ))}
        </div>

        {/* ── Right action icons ── */}
        <div className="flex items-center justify-end gap-1 sm:gap-2">
          {/* Search — visible on lg+ */}
          <label className="hidden h-9 w-56 items-center gap-2 rounded-full border border-olive-leaf bg-warm-mist px-4 lg:flex">
            <Search className="size-4 text-olive-leaf" aria-hidden="true" />
            <span className="sr-only">Search products</span>
            <input
              type="search"
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent font-sans text-xs text-black-forest outline-none placeholder:text-olive-leaf/60"
            />
          </label>

          {/* Wishlist */}
          <Link
            href="/wishlist"
            className="relative flex size-9 items-center justify-center rounded-full text-black-forest transition-opacity hover:opacity-70"
            aria-label="Open wishlist"
          >
            <Heart className="size-5" aria-hidden="true" />
            {isMounted && wishlistCount > 0 && (
              <span className="absolute -right-1 top-0 flex size-4 items-center justify-center rounded-full bg-copperwood font-sans text-3xs font-medium text-cornsilk">
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart */}
          <Link
            href="/cart"
            className="relative flex size-9 items-center justify-center rounded-full text-black-forest transition-opacity hover:opacity-70"
            aria-label="Open shopping bag"
          >
            <ShoppingBag className="size-5" aria-hidden="true" />
            {isMounted && itemCount > 0 && (
              <span className="absolute -right-1 top-0 flex size-4 items-center justify-center rounded-full bg-copperwood font-sans text-3xs font-medium text-cornsilk">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </Link>

          {/* Account — hidden on mobile xs, shown sm+ */}
          <Link
            href="/profile"
            className="hidden size-9 items-center justify-center rounded-full text-black-forest transition-opacity hover:opacity-70 sm:flex"
            aria-label="View your profile"
          >
            <User className="size-5" aria-hidden="true" />
          </Link>

          {/* ── Hamburger — mobile only, hidden md+ ── */}
          <Sheet open={mobileOpen} onOpenChange={handleOpenChange}>
            <SheetTrigger
              className="flex size-9 items-center justify-center rounded-full text-black-forest transition-opacity hover:opacity-70 md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>

            <SheetContent
              side="left"
              showCloseButton={false}
              className="flex w-[min(80vw,320px)] flex-col gap-0 p-0 bg-cornsilk sm:max-w-[320px]"
            >
              {/* Drawer header */}
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-olive-leaf/15 px-5">
                <Link
                  href="/"
                  onClick={closeMobile}
                  aria-label="Indian Mist home"
                  className="flex h-full max-w-[140px] items-center"
                >
                  <Image
                    src="/InCollage_20260513_093524159.png"
                    alt="Indian Mist Logo"
                    width={44}
                    height={44}
                    className="h-11 w-11 object-contain"
                    priority
                  />
                </Link>

                {/* Close button uses SheetClose which renders a <button> natively */}
                <SheetClose
                  className="flex size-9 items-center justify-center rounded-full text-black-forest transition-opacity hover:opacity-70"
                  aria-label="Close navigation menu"
                >
                  <X className="size-5" aria-hidden="true" />
                </SheetClose>
              </div>

              {/* Nav links */}
              <nav
                className="flex-1 overflow-y-auto py-2"
                aria-label="Mobile navigation"
              >
                <ul>
                  {navLinks.map((link) => (
                    <li
                      key={link.name}
                      className="border-b border-olive-leaf/10 last:border-b-0"
                    >
                      <MobileNavItem
                        link={link}
                        isActive={
                          link.href === "/"
                            ? pathname === "/"
                            : pathname.startsWith(link.href)
                        }
                        onClose={closeMobile}
                      />
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Drawer footer — search + account */}
              <div className="shrink-0 space-y-3 border-t border-olive-leaf/15 px-5 py-4">
                {/* Search */}
                <label className="flex h-10 items-center gap-2 rounded-full border border-olive-leaf bg-warm-mist px-4">
                  <Search
                    className="size-4 shrink-0 text-olive-leaf"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Search products</span>
                  <input
                    type="search"
                    placeholder="Search products…"
                    className="min-w-0 flex-1 bg-transparent font-sans text-xs text-black-forest outline-none placeholder:text-olive-leaf/60"
                  />
                </label>

                {/* Account */}
                <Link
                  href="/profile"
                  onClick={closeMobile}
                  className="flex w-full items-center gap-3 rounded-full border border-olive-leaf/25 px-4 py-2.5 font-sans text-xs font-medium uppercase tracking-widest text-black-forest/70 transition-colors hover:text-black-forest"
                >
                  <User className="size-4 shrink-0" aria-hidden="true" />
                  My profile
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
