import type { Metadata } from "next";
import dbConnect from "@/lib/db";
import SiteSettingsModel from "@/models/settings.model";
import { Geist, Geist_Mono, Merriweather, Montserrat } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/home/AnnouncementBar";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { StoreHydration } from "@/lib/use-store-hydration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const merriweather = Merriweather({
  variable: "--font-merriweather",
  weight: ["300", "400", "700", "900"],
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    await dbConnect();
    const settings = await SiteSettingsModel.findOne().lean() as any;
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
  let settings = null;
  try {
    await dbConnect();
    settings = await SiteSettingsModel.findOne().lean();
  } catch (e) {
    console.error("Failed to fetch settings for layout", e);
  }
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${merriweather.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <StoreHydration />
        <AnnouncementBar />
        <Navbar />
        <main className="flex-1 w-full">{children}</main>
        <Footer settings={settings as any} />
      </body>
    </html>
  );
}
