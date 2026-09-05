'use client';

import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { User } from '@/types/admin';

export default function AdminTopBar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('im_admin_user');
    if (userStr) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(JSON.parse(userStr));
      } catch {
        // Handle error silently
      }
    }
  }, []);

  // Derive title from pathname
  let title = 'Dashboard';
  if (pathname.includes('/products/new')) title = 'Add Product';
  else if (pathname.includes('/products/')) title = 'Edit Product';
  else if (pathname.includes('/products')) title = 'Products';
  else if (pathname.includes('/announcements')) title = 'Announcements';
  else if (pathname.includes('/carousel')) title = 'Carousel';
  else if (pathname.includes('/about')) title = 'About Page';
  else if (pathname.includes('/settings')) title = 'Site Settings';

  return (
    <header className="h-14 bg-card border-b border-olive/10 flex items-center justify-between px-6 md:px-8">
      <h2 className="font-merriweather text-lg font-normal text-forest">
        {title}
      </h2>
      
      <div className="flex items-center gap-4">
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
