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

type NavItem = { name: string; slug: string };

function buildNavLinks(
  categories: NavItem[],
  collections: NavItem[],
): NavLink[] {
  return [
    { name: "Home", href: "/" },
    {
      name: "Products",
      href: "/products",
      children: categories.map((c) => ({
        name: c.name,
        href: `/products?category=${c.slug}`,
      })),
    },
    ...(collections.length > 0
      ? [{
          name: "Collections",
          href: "/collections",
          children: collections.map((c) => ({
            name: c.name,
            href: `/collections/${c.slug}`,
          })),
        }]
      : []),
    { name: "About", href: "/about" },
    { name: "Blogs", href: "/blogs" },
    { name: "Contact Us", href: "/contact" },
  ];
}

// ─── Desktop nav link ────────────────────────────────────────────────────────

function DesktopNavLink({
  link,
  isActive,
}: {
  link: NavLink;
  isActive: boolean;
}) {
  const hasChildren = Boolean(link.children?.length);

  if (!hasChildren) {
    return (
      <Link
        href={link.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "font-sans text-sm font-normal uppercase tracking-widest transition-all",
          isActive
            ? "text-olive-leaf underline underline-offset-8 decoration-2 decoration-olive-leaf"
            : "text-black-forest/85 hover:opacity-100 hover:text-black-forest"
        )}
      >
        {link.name}
      </Link>
    );
  }

  return (
    <div className="group relative">
      <Link
        href={link.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-1 font-sans text-sm font-normal uppercase tracking-widest transition-all",
          isActive
            ? "text-olive-leaf underline underline-offset-8 decoration-2 decoration-olive-leaf"
            : "text-black-forest/85 hover:opacity-100 hover:text-black-forest"
        )}
      >
        {link.name}
        <ChevronDown className="size-3 opacity-50 transition-transform group-hover:rotate-180" aria-hidden="true" />
      </Link>

      <div className="pointer-events-none absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="min-w-48 rounded-home-card border border-olive-leaf/15 bg-cornsilk p-2 shadow-lg">
          <Link
            href={link.href}
            className="block rounded-sm px-4 py-2.5 font-sans text-sm font-normal uppercase tracking-widest text-olive-leaf transition-colors hover:bg-warm-mist"
          >
            All {link.name}
          </Link>
          {link.children!.map((child) => (
            <Link
              key={child.name}
              href={child.href}
              className="block rounded-sm px-4 py-2.5 font-sans text-sm font-light tracking-wide text-black-forest/80 transition-colors hover:bg-warm-mist hover:text-black-forest"
            >
              {child.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
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
    "flex w-full items-center px-5 py-3.5 font-sans text-base font-normal uppercase tracking-widest transition-colors",
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
          "flex w-full items-center justify-between px-5 py-3.5 font-sans text-base font-normal uppercase tracking-widest transition-colors",
          isActive
            ? "text-olive-leaf"
            : "text-black-forest/80 hover:text-black-forest"
        )}
      >
        <span>{link.name}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-olive-leaf/85 transition-transform duration-200",
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
              className="flex w-full items-center gap-2 px-4 py-2.5 font-sans text-sm font-normal uppercase tracking-widest text-olive-leaf transition-colors hover:text-black-forest"
            >
              All {link.name}
            </Link>
          </li>

          {link.children!.map((child) => (
            <li key={child.name}>
              <Link
                href={child.href}
                onClick={onClose}
                className="flex w-full items-center gap-2 px-4 py-2.5 font-sans text-sm font-light tracking-wide text-black-forest/80 transition-colors hover:text-black-forest"
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

export function Navbar({
  categories = [],
  collections = [],
}: {
  categories?: NavItem[];
  collections?: NavItem[];
}) {
  const pathname = usePathname();
  const navLinks = buildNavLinks(categories, collections);

  const isHome = pathname === "/";
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const wishlistCount = useWishlistStore((s) => s.items.length);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const handleOpenChange = useCallback(
    (open: boolean) => setMobileOpen(open),
    []
  );

  // Hide storefront navbar on admin pages
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <nav
      className={cn(
        "sticky z-40 h-16 w-full border-b border-olive-leaf/15 bg-cornsilk transition-shadow duration-300",
        isHome ? "top-8 sm:top-7" : "top-0",
        scrolled && "shadow-sm"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center justify-between gap-4 px-4 md:px-12">
        {/* ── Logo ── */}
        <Link
          href="/"
          className="flex h-full max-w-35 shrink-0 items-center md:max-w-45"
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
                  className="flex h-full max-w-35 items-center"
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


                {/* Account */}
                <Link
                  href="/profile"
                  onClick={closeMobile}
                  className="flex w-full items-center gap-3 rounded-full border border-olive-leaf/25 px-4 py-2.5 font-sans text-xs font-medium uppercase tracking-widest text-black-forest/80 transition-colors hover:text-black-forest"
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
