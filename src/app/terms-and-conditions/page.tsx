import type { Metadata } from "next";
import { LegalPageView, getLegalPage } from "@/components/legal/LegalPageView";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { title } = await getLegalPage("terms-and-conditions");
  return { title: `${title} | Indian Mist` };
}

export default function Page() {
  return <LegalPageView slug="terms-and-conditions" />;
}
