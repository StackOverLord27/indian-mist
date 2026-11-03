import { cache } from "react";
import dbConnect from "@/lib/db";
import SiteSettingsModel from "@/models/settings.model";
import { Category } from "@/models/category.model";
import { Product as ProductModel } from "@/models/product.model";
import { Collection } from "@/models/collection.model";
import AnnouncementModel from "@/models/announcement.model";
import LegalPage from "@/models/legal-page.model";
import { LEGAL_DEFAULTS, OPTIONAL_LEGAL_SLUGS, hasLegalText, type OptionalLegalSlug } from "@/lib/legal-pages";
import type { SiteSettings } from "@/types/admin";

/*
 * Storefront data shared by generateMetadata, the root layout, AnnouncementBar and pages.
 *
 * Each helper is wrapped in React `cache`, so one render runs each query once no matter how
 * many components ask for it.
 *
 * These helpers deliberately do NOT catch errors. A missing document is fine (null / empty
 * list), but a database failure must throw:
 *  - at build time the build fails loudly instead of baking an empty site into the cache;
 *  - during ISR regeneration Next.js keeps serving the last good page when the render throws,
 *    whereas a swallowed error would replace it with a blank one.
 */

export const getSiteSettings = cache(async (): Promise<SiteSettings | null> => {
  await dbConnect();
  const settings = await SiteSettingsModel.findOne().lean<SiteSettings>();
  return settings ? JSON.parse(JSON.stringify(settings)) : null;
});

/**
 * How many products each category has: ONE grouped count over the products' category field
 * (an index covers it), instead of joining every product onto every category to measure the size.
 */
export const getCategoryCounts = cache(async (): Promise<Record<string, number>> => {
  await dbConnect();
  const rows = await ProductModel.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
});

/** slug -> real name of EVERY category (hidden ones too): products of a hidden category are still on sale. */
export const getCategoryNames = cache(async (): Promise<Record<string, string>> => {
  await dbConnect();
  const categories = await Category.find({}).select("name slug").lean<{ name: string; slug: string }[]>();
  return Object.fromEntries(categories.map((c) => [c.slug, c.name]));
});

export type NavLink = { name: string; slug: string };

export const getNavCategories = cache(async (): Promise<NavLink[]> => {
  await dbConnect();
  const categories = await Category.find({ isHidden: { $ne: true } })
    .sort({ order: 1, name: 1 })
    .select("name slug")
    .lean<NavLink[]>();
  return categories.map((c) => ({ name: c.name, slug: c.slug }));
});

export const getNavCollections = cache(async (): Promise<NavLink[]> => {
  await dbConnect();
  const collections = await Collection.find({ isActive: true })
    .sort({ order: 1, name: 1 })
    .select("name slug")
    .lean<NavLink[]>();
  return collections.map((c) => ({ name: c.name, slug: c.slug }));
});

export const getAnnouncementTexts = cache(async (): Promise<string[]> => {
  await dbConnect();
  const items = await AnnouncementModel.find({ isActive: true })
    // Oldest first; _id breaks ties between items created in the same millisecond.
    .sort({ createdAt: 1, _id: 1 })
    .select("text")
    .lean<{ text: string }[]>();
  return items.map((item) => item.text);
});

/**
 * Which optional policy pages (refund, shipping) have text saved, so the footer and the sitemap
 * link only to pages that exist. One small query. A database failure throws (see the note at the top).
 */
export const getPublishedOptionalPolicies = cache(async (): Promise<{ slug: OptionalLegalSlug; title: string }[]> => {
  await dbConnect();
  const docs = await LegalPage.find({ slug: { $in: [...OPTIONAL_LEGAL_SLUGS] } })
    .select("slug title content")
    .lean<{ slug: OptionalLegalSlug; title?: string; content?: string }[]>();
  return OPTIONAL_LEGAL_SLUGS.flatMap((slug) => {
    const doc = docs.find((d) => d.slug === slug);
    return doc && hasLegalText(doc.content) ? [{ slug, title: doc.title?.trim() || LEGAL_DEFAULTS[slug].title }] : [];
  });
});
