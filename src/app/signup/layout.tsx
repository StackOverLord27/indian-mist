import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";

// Account pages are not for search results
export const metadata: Metadata = { title: "Create an account", robots: NOINDEX };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
