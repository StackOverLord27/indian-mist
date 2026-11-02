import { getAnnouncementTexts } from "@/lib/storefront-data";
import { AnnouncementBarClient } from "./AnnouncementBarClient";

export async function AnnouncementBar() {
  // Errors are deliberately not caught here: see src/lib/storefront-data.ts
  const displayItems = await getAnnouncementTexts();
  return <AnnouncementBarClient displayItems={displayItems} />;
}
