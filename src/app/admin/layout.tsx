import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";

// Nothing in the admin may appear in search results (robots.txt also disallows it)
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
