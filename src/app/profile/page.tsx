import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";
import { ProfilePageClient } from "@/components/profile/ProfilePageClient";

export const metadata: Metadata = {
  title: "My Profile",
  robots: NOINDEX,
  description: "Manage your account details, delivery address, and order history.",
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}
