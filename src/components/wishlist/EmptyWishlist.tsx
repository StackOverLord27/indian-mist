import Link from "next/link";
import { Heart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyWishlist() {
  return (
    <div className="py-24 text-center max-w-sm mx-auto">
      <Heart className="w-16 h-16 text-olive/20 mx-auto mb-6" />
      <h2 className="font-merriweather text-xl font-normal text-forest mb-2">
        Your wishlist is empty
      </h2>
      <p className="font-montserrat text-sm font-normal text-muted-text mb-8 leading-relaxed">
        Save products you love and come back to them anytime.
      </p>
      <Link
        href="/products"
        className={cn(
          buttonVariants({ variant: "default" }),
          "bg-forest text-cornsilk hover:bg-olive font-montserrat text-xs font-semibold uppercase tracking-wider px-8 py-3.5 rounded-sm h-auto inline-flex"
        )}
      >
        Explore Collection
      </Link>
    </div>
  );
}
