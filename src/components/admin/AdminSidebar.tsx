'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  Megaphone, 
  Images, 
  FileText, 
  Settings,
  LogOut
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { User } from '@/types/admin';

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('im_admin_user');
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {}
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('im_admin_token');
    localStorage.removeItem('im_admin_user');
    router.push('/admin/login');
  };

  const navGroups = [
    {
      label: 'Dashboard',
      items: [
        { label: 'Overview', href: '/admin', icon: LayoutDashboard, exact: true },
      ]
    },
    {
      label: 'Products',
      items: [
        { label: 'Products List', href: '/admin/products', icon: Package, exact: true },
        { label: 'Add Product', href: '/admin/products/new', icon: Package, exact: false },
      ]
    },
    {
      label: 'Homepage',
      items: [
        { label: 'Announcements', href: '/admin/announcements', icon: Megaphone, exact: true },
        { label: 'Carousel', href: '/admin/carousel', icon: Images, exact: true },
      ]
    },
    {
      label: 'Pages',
      items: [
        { label: 'About Page', href: '/admin/about', icon: FileText, exact: true },
        { label: 'Site Settings', href: '/admin/settings', icon: Settings, exact: true },
      ]
    }
  ];

  return (
    <aside className="w-60 bg-forest flex-shrink-0 flex flex-col h-full">
      <div className="p-6 border-b border-white/5">
        <h1 className="font-merriweather text-cornsilk text-xl">Indian Mist</h1>
        <p className="font-montserrat text-[10px] text-clay uppercase tracking-widest mt-1">Admin</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {navGroups.map((group, i) => (
          <div key={i} className="mb-4">
            <h2 className="font-montserrat text-[9px] uppercase tracking-widest text-cornsilk/30 px-4 pt-5 pb-1">
              {group.label}
            </h2>
            <ul>
              {group.items.map((item, j) => {
                const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                
                return (
                  <li key={j}>
                    <Link
                      href={item.href}
                      className={`font-montserrat text-xs font-medium uppercase tracking-wide px-4 py-2.5 transition-colors flex items-center gap-3 ${
                        isActive 
                          ? 'bg-white/10 text-cornsilk border-l-2 border-clay' 
                          : 'text-cornsilk/60 hover:text-cornsilk hover:bg-white/5'
                      }`}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <div className="flex flex-col gap-2">
          {user && (
            <p className="font-montserrat text-xs text-cornsilk/60 truncate px-2">
              {user.email}
            </p>
          )}
          <button 
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 font-montserrat text-xs uppercase tracking-wide text-cornsilk/80 hover:text-cornsilk hover:bg-white/10 py-2 rounded-sm transition-colors"
          >
            <LogOut className="size-4" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
