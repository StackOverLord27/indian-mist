import { getSiteUrl } from "@/lib/env";
import { SITE_NAME } from "@/lib/seo";
import type { Metadata } from "next";
import { getSiteSettings, getNavCategories, getNavCollections } from "@/lib/storefront-data";
import { Merriweather, Montserrat } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/home/AnnouncementBar";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { StoreHydration } from "@/lib/use-store-hydration";
import { AppToaster } from "@/components/ui/AppToaster";
import { ClientSetup } from "@/components/ui/ClientSetup";

// Safety net for pages that have no revalidate of their own (cart, sign-in, ...): their navbar,
// announcement bar and footer are rebuilt at least hourly. Admin changes refresh them at once
// through revalidateStorefront(); pages that set a shorter revalidate keep their own value.
export const revalidate = 3600;

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
  // A database failure must throw (see src/lib/storefront-data.ts), not fall back to defaults
  const settings = await getSiteSettings();
  // What the admin typed, or just the shop's name: no invented tagline or description
  const title = settings?.metaTitle?.trim() || SITE_NAME;
  const description = settings?.metaDescription?.trim() || undefined;
  return {
    // Canonical links, Open Graph addresses and the sitemap all start from the public site address
    metadataBase: new URL(getSiteUrl()),
    title: { default: title, template: `%s | ${SITE_NAME}` },
    description,
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [settings, navCategories, navCollections] = await Promise.all([
    getSiteSettings(),
    getNavCategories(),
    getNavCollections(),
  ]);
  return (
    <html
      lang="en"
      className={`${merriweather.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <StoreHydration />
        <ClientSetup />
        <AppToaster />
        {/* One sticky wrapper for both bars: they stack with no gap when the announcement bar is
            empty, and can never overlap. The wrapper has no height on admin pages (both hide). */}
        <div className="sticky top-0 z-50">
          <AnnouncementBar />
          <Navbar categories={navCategories} collections={navCollections} />
        </div>
        <main className="flex-1 w-full">{children}</main>
        <Footer settings={settings ?? undefined} categories={navCategories} collections={navCollections} />
      </body>
    </html>
  );
}
