"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** The admin frame (sidebar, top bar). Wrapped by app/admin/layout.tsx, which marks every admin page noindex. */
export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";
  // Below 1024 px the sidebar is a drawer opened from the top bar
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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
        <AdminSidebar open={menuOpen} onNavigate={closeMenu} />
        {menuOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={closeMenu} aria-hidden="true" />
        )}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <AdminTopBar onMenuClick={() => setMenuOpen(true)} />
          <div className="p-4 sm:p-6 md:p-8">{children}</div>
        </main>
      </div>
    </QueryClientProvider>
  );
}
