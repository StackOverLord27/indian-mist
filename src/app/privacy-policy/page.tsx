import type { Metadata } from "next";
import { LegalPageView, getLegalPage } from "@/components/legal/LegalPageView";

// Saving the page in the admin refreshes it straight away (revalidatePath in the legal route)
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { title } = await getLegalPage("privacy-policy");
  return { title: `${title} | Indian Mist` };
}

export default function Page() {
  return <LegalPageView slug="privacy-policy" />;
}
