'use client';

import { usePathname } from 'next/navigation';
import { Bell, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { User } from '@/types/admin';

/** The heading for an admin page, from its address. Specific pages (new / edit) before their list. */
export function adminPageTitle(pathname: string): string {
  const rules: [RegExp, string][] = [
    [/^\/admin\/products\/new/, 'Add Product'],
    [/^\/admin\/products\/.+/, 'Edit Product'],
    [/^\/admin\/products/, 'Products'],
    [/^\/admin\/categories\/new/, 'Add Category'],
    [/^\/admin\/categories\/.+/, 'Edit Category'],
    [/^\/admin\/categories/, 'Categories'],
    [/^\/admin\/collections\/new/, 'Add Collection'],
    [/^\/admin\/collections\/.+/, 'Edit Collection'],
    [/^\/admin\/collections/, 'Collections'],
    [/^\/admin\/blogs\/new/, 'New Blog Post'],
    [/^\/admin\/blogs\/.+/, 'Edit Blog Post'],
    [/^\/admin\/blogs/, 'Blog Posts'],
    [/^\/admin\/orders/, 'Orders'],
    [/^\/admin\/pricing/, 'Pricing & Promos'],
    [/^\/admin\/homepage/, 'Layout & Text'],
    [/^\/admin\/contact/, 'Contact Page'],
    [/^\/admin\/legal\/privacy/, 'Privacy Policy'],
    [/^\/admin\/legal\/terms/, 'Terms & Conditions'],
    [/^\/admin\/legal\/refund/, 'Refund Policy'],
    [/^\/admin\/legal\/shipping/, 'Shipping Policy'],
    [/^\/admin\/legal\/.+/, 'Legal Page'],
    [/^\/admin\/announcements/, 'Announcements'],
    [/^\/admin\/carousel/, 'Carousel'],
    [/^\/admin\/about/, 'About Page'],
    [/^\/admin\/settings/, 'Site Settings'],
  ];
  return rules.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'Dashboard';
}

export default function AdminTopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('im_admin_user');
    if (userStr) {
      try {
         
        setUser(JSON.parse(userStr));
      } catch {
        // Handle error silently
      }
    }
  }, []);

  const title = adminPageTitle(pathname);

  return (
    <header className="h-14 bg-card border-b border-olive/10 flex items-center justify-between gap-3 px-4 sm:px-6 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-full text-forest hover:bg-olive/10 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <h2 className="truncate font-merriweather text-lg font-normal text-forest">
          {title}
        </h2>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <button className="text-forest/60 hover:text-forest transition-colors">
          <Bell className="size-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-olive flex items-center justify-center text-cornsilk font-montserrat text-sm font-semibold uppercase">
          {user?.email ? user.email.charAt(0) : 'A'}
        </div>
      </div>
    </header>
  );
}
