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
  return {
    title: settings?.metaTitle || "Indian Mist | Eco-friendly Forest Gear",
    description: settings?.metaDescription || "Premium eco-friendly outdoor gear and products designed with nature in mind.",
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
        <AnnouncementBar />
        <Navbar categories={navCategories} collections={navCollections} />
        <main className="flex-1 w-full">{children}</main>
        <Footer settings={settings ?? undefined} categories={navCategories} collections={navCollections} />
      </body>
    </html>
  );
}
