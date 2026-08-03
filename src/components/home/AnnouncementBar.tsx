import dbConnect from "@/lib/db";
import AnnouncementModel from "@/models/announcement.model";

export async function AnnouncementBar() {
  let displayItems: string[] = [];
  
  try {
    await dbConnect();
    const items = await AnnouncementModel.find({ isActive: true })
      .sort({ order: 1 })
      .lean();
    
    displayItems = items.map((item: any) => item.text);
  } catch (error) {
    console.error("Failed to fetch announcements:", error);
  }

  // Fallback
  if (displayItems.length === 0) {
    displayItems = ["Free shipping on orders above ₹999", "1 tree planted with every order"];
  }

  return (
    <div className="sticky top-0 z-50 flex h-8 w-full items-center justify-center overflow-hidden bg-black-forest px-4 font-sans text-2xs uppercase tracking-widest text-cornsilk sm:h-7">
      <div className="flex items-center">
        {displayItems.map((text, i) => (
          <span key={i} className="flex items-center">
            {i > 0 && (
              <span className="mx-3 shrink-0 text-sunlit-clay" aria-hidden="true">
                ·
              </span>
            )}
            <span className="block truncate max-w-[250px] sm:max-w-none">{text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
