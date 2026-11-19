import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { LegalPageView, getLegalPage } from "@/components/legal/LegalPageView";

// Saving the page in the admin refreshes it straight away (revalidatePath in the legal route)
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { title } = await getLegalPage("privacy-policy");
  return pageMetadata({ title, path: "/privacy-policy" });
}

export default function Page() {
  return <LegalPageView slug="privacy-policy" />;
}
