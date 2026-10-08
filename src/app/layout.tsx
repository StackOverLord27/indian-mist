import type { Metadata } from "next";
import dbConnect from "@/lib/db";
import SiteSettingsModel from "@/models/settings.model";
import { Category } from "@/models/category.model";
import { Collection } from "@/models/collection.model";
import type { SiteSettings } from "@/types/admin";
import { Merriweather, Montserrat } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/home/AnnouncementBar";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { StoreHydration } from "@/lib/use-store-hydration";
import { AppToaster } from "@/components/ui/AppToaster";

// Variable fonts: one file covers every weight. Merriweather also loads italic for headings.
const merriweather = Merriweather({
  variable: "--font-merriweather",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    await dbConnect();
    const settings = await SiteSettingsModel.findOne().lean<SiteSettings>();
    return {
      title: settings?.metaTitle || "Indian Mist | Eco-friendly Forest Gear",
      description: settings?.metaDescription || "Premium eco-friendly outdoor gear and products designed with nature in mind.",
    };
  } catch (error) {
    return {
      title: "Indian Mist | Eco-friendly Forest Gear",
      description: "Premium eco-friendly outdoor gear and products designed with nature in mind.",
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let settings: SiteSettings | null = null;
  let navCategories: { name: string; slug: string }[] = [];
  let navCollections: { name: string; slug: string }[] = [];
  try {
    await dbConnect();
    const [rawSettings, cats, cols] = await Promise.all([
      SiteSettingsModel.findOne().lean<SiteSettings>(),
      Category.find({ isHidden: { $ne: true } }).sort({ order: 1, name: 1 }).select("name slug").lean<{ name: string; slug: string }[]>(),
      Collection.find({ isActive: true }).sort({ order: 1, name: 1 }).select("name slug").lean<{ name: string; slug: string }[]>(),
    ]);
    settings = rawSettings ? JSON.parse(JSON.stringify(rawSettings)) : null;
    navCategories = cats.map((c) => ({ name: c.name, slug: c.slug }));
    navCollections = cols.map((c) => ({ name: c.name, slug: c.slug }));
  } catch (e) {
    console.error("Failed to fetch settings for layout", e);
  }
  return (
    <html
      lang="en"
      className={`${merriweather.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <StoreHydration />
        <AppToaster />
        <AnnouncementBar />
        <Navbar categories={navCategories} collections={navCollections} />
        <main className="flex-1 w-full">{children}</main>
        <Footer settings={settings ?? undefined} categories={navCategories} collections={navCollections} />
      </body>
    </html>
  );
}
