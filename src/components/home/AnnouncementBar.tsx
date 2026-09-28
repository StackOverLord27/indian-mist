import dbConnect from "@/lib/db";
import AnnouncementModel from "@/models/announcement.model";
import { AnnouncementBarClient } from "./AnnouncementBarClient";

export async function AnnouncementBar() {
  let displayItems: string[] = [];
  
  try {
    await dbConnect();
    const items = await AnnouncementModel.find({ isActive: true })
      .sort({ order: 1 })
      .lean();
    
    displayItems = items.map((item: { text: string }) => item.text);
  } catch (error) {
    console.error("Failed to fetch announcements:", error);
  }

  // Fallback
  if (displayItems.length === 0) {
    displayItems = ["Free shipping on orders above ₹999", "1 tree planted with every order"];
  }

  return <AnnouncementBarClient displayItems={displayItems} />;
}
