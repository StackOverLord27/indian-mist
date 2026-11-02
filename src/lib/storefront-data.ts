import { cache } from "react";
import dbConnect from "@/lib/db";
import SiteSettingsModel from "@/models/settings.model";
import { Category } from "@/models/category.model";
import { Collection } from "@/models/collection.model";
import AnnouncementModel from "@/models/announcement.model";
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
    .sort({ order: 1 })
    .select("text")
    .lean<{ text: string }[]>();
  return items.map((item) => item.text);
});
