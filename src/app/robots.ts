import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";

// Shoppers' own pages, the admin and the API are not for search engines. (This only asks crawlers
// not to visit; the pages themselves also say "noindex", which is what keeps them out of results.)
export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/cart", "/checkout", "/profile", "/wishlist", "/signin", "/signup", "/forgot-password"],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
