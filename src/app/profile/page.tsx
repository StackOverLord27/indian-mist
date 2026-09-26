import type { Metadata } from "next";
import { ProfilePageClient } from "@/components/profile/ProfilePageClient";

export const metadata: Metadata = {
  title: "My Profile | Indian Mist",
  description: "Manage your account details, delivery address, and order history.",
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}
