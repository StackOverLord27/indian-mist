import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyCart() {
  return (
    <div className="py-24 text-center max-w-sm mx-auto">
      <ShoppingBag className="w-16 h-16 text-olive/20 mx-auto mb-6" />
      <h2 className="font-merriweather text-xl font-normal text-forest mb-2">
        Your bag is empty
      </h2>
      <p className="font-montserrat text-sm font-normal text-muted-text mb-8 leading-relaxed">
        Looks like you haven&apos;t added anything yet. Explore our collection.
      </p>
      <Link
        href="/products"
        className={cn(
          buttonVariants({ variant: "default" }),
          "bg-forest text-cornsilk hover:bg-olive font-montserrat text-xs font-semibold uppercase tracking-wider px-8 py-3.5 rounded-sm h-auto inline-flex"
        )}
      >
        Shop now
      </Link>
    </div>
  );
}
