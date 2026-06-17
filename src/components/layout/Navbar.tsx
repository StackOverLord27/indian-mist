"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, ShoppingCart, Heart, User, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Products", href: "/products", subLinks: [
    { name: "All Products", href: "/products" },
    { name: "New Arrivals", href: "/products?category=new" },
    { name: "Best Sellers", href: "/products?category=best-sellers" }
  ] },
  { name: "About", href: "/about" },
  { name: "Blogs", href: "/blogs" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container mx-auto flex h-16 items-center px-4 md:px-8">
        
        {/* Mobile Hamburger Menu */}
        <div className="md:hidden flex items-center mr-4">
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="text-foreground hover:bg-primary/10" />
              }
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle Menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px] bg-background border-r border-border">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="flex flex-col gap-6 py-6">
                <Link href="/" className="flex items-center gap-2">
                  <Leaf className="h-6 w-6 text-primary" />
                  <span className="font-bold text-xl text-primary tracking-tight">Indian Mist</span>
                </Link>
                <div className="flex flex-col space-y-4">
                  {navLinks.map((link) => (
                    <div key={link.name} className="flex flex-col space-y-2">
                      <Link
                        href={link.href}
                        className="text-lg font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {link.name}
                      </Link>
                      {link.subLinks && (
                        <div className="flex flex-col pl-4 space-y-2 border-l-2 border-primary/20 mt-1">
                          {link.subLinks.map((subLink) => (
                            <Link
                              key={subLink.name}
                              href={subLink.href}
                              className="text-base text-foreground/70 hover:text-primary transition-colors"
                            >
                              {subLink.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Logo */}
        <div className="flex items-center gap-2 mr-6">
          <Link href="/" className="flex items-center gap-2 group">
            <Leaf className="h-6 w-6 text-primary group-hover:rotate-12 transition-transform duration-300" />
            <span className="hidden sm:inline-block font-bold text-xl tracking-tight text-primary">Indian Mist</span>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex flex-1 items-center space-x-8 text-sm font-medium">
          {navLinks.map((link) => (
            <div key={link.name} className="relative group py-4">
              <Link
                href={link.href}
                className="text-foreground/80 transition-colors hover:text-primary hover:underline underline-offset-8 decoration-2 decoration-primary/50"
              >
                {link.name}
              </Link>
              {link.subLinks && (
                <div className="absolute left-0 top-full mt-0 hidden w-48 flex-col rounded-md border border-border/40 bg-background/95 backdrop-blur shadow-md group-hover:flex overflow-hidden">
                  {link.subLinks.map((subLink) => (
                    <Link
                      key={subLink.name}
                      href={subLink.href}
                      className="px-4 py-3 text-sm text-foreground/80 hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {subLink.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right side icons */}
        <div className="flex flex-1 md:flex-none items-center justify-end space-x-2">
          <div className="w-full max-w-[200px] lg:max-w-[300px] hidden lg:flex items-center relative mr-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder={pathname?.startsWith("/products") ? "Search Products..." : "Search..."}
              className="flex h-9 w-full rounded-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 pl-9"
            />
          </div>
          
          <Button variant="ghost" size="icon" className="lg:hidden text-foreground hover:bg-primary/10 hover:text-primary transition-colors rounded-full">
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Button>

          <Button variant="ghost" size="icon" className="text-foreground hover:bg-primary/10 hover:text-primary transition-colors group rounded-full">
            <Heart className="h-5 w-5 group-hover:scale-110 transition-transform" />
            <span className="sr-only">Wishlist</span>
          </Button>
          
          <Button variant="ghost" size="icon" className="text-foreground hover:bg-primary/10 hover:text-primary transition-colors group rounded-full">
            <ShoppingCart className="h-5 w-5 group-hover:scale-110 transition-transform" />
            <span className="sr-only">Cart</span>
          </Button>
          
          <Button variant="ghost" size="icon" className="text-foreground hover:bg-primary/10 hover:text-primary transition-colors group rounded-full">
            <User className="h-5 w-5 group-hover:scale-110 transition-transform" />
            <span className="sr-only">Profile</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
