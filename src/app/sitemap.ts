import type { MetadataRoute } from "next";
import dbConnect from "@/lib/db";
import { getSiteUrl } from "@/lib/env";
import { Product } from "@/models/product.model";
import { Collection } from "@/models/collection.model";
import { Blog } from "@/models/blog.model";
import { getPublishedOptionalPolicies } from "@/lib/storefront-data";

// Built from the database and refreshed hourly (and straight away after admin changes, like the
// pages themselves). A database failure throws on purpose: a failed rebuild keeps the last good
// sitemap instead of publishing an empty one.
export const revalidate = 3600;

// One sitemap file holds at most 50,000 addresses; this shop is far below that
const MAX_URLS = 45_000;

const STATIC_PAGES: { path: string; changeFrequency: "daily" | "weekly" | "monthly"; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/products", changeFrequency: "daily", priority: 0.9 },
  { path: "/collections", changeFrequency: "weekly", priority: 0.7 },
  { path: "/blogs", changeFrequency: "weekly", priority: 0.6 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy-policy", changeFrequency: "monthly", priority: 0.2 },
  { path: "/terms-and-conditions", changeFrequency: "monthly", priority: 0.2 },
];

type Dated = { slug: string; updatedAt?: Date };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  await dbConnect();

  const [products, collections, blogs, policies] = await Promise.all([
    Product.find({}).select("slug updatedAt").sort({ _id: 1 }).limit(MAX_URLS).lean<Dated[]>(),
    Collection.find({ isActive: true }).select("slug updatedAt").sort({ _id: 1 }).limit(MAX_URLS).lean<Dated[]>(),
    Blog.find({ isPublished: true }).select("slug updatedAt").sort({ _id: 1 }).limit(MAX_URLS).lean<Dated[]>(),
    getPublishedOptionalPolicies(),
  ]);

  const entry = (path: string, changeFrequency: "daily" | "weekly" | "monthly", priority: number, lastModified?: Date) => ({
    url: `${site}${path}`,
    ...(lastModified && { lastModified }),
    changeFrequency,
    priority,
  });

  return [
    ...STATIC_PAGES.map((p) => entry(p.path, p.changeFrequency, p.priority)),
    // refund / shipping policy pages exist only once the owner has saved text
    ...policies.map((p) => entry(`/${p.slug}`, "monthly", 0.2)),
    ...products.map((p) => entry(`/products/${p.slug}`, "weekly", 0.8, p.updatedAt)),
    ...collections.map((c) => entry(`/collections/${c.slug}`, "weekly", 0.6, c.updatedAt)),
    ...blogs.map((b) => entry(`/blogs/${b.slug}`, "monthly", 0.5, b.updatedAt)),
  ].slice(0, MAX_URLS);
}
