"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { usePathname } from "next/navigation";

/** The admin frame (sidebar, top bar). Wrapped by app/admin/layout.tsx, which marks every admin page noindex. */
export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen bg-warm overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto">
          <AdminTopBar />
          <div className="p-6 md:p-8">{children}</div>
        </main>
      </div>
    </QueryClientProvider>
  );
}
