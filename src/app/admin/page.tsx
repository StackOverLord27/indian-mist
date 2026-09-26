'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import AdminCard from '@/components/admin/ui/AdminCard';
import { Package, Megaphone, Images, Activity, Library, PenLine } from 'lucide-react';
import Link from 'next/link';
import { useAdminProducts } from '@/hooks/admin/useAdminProducts';
import { useAnnouncements } from '@/hooks/admin/useAdminAnnouncements';
import { useCarousel } from '@/hooks/admin/useAdminCarousel';
import { useAdminCollections } from '@/hooks/admin/useAdminCollections';
import { useAdminBlogs } from '@/hooks/admin/useAdminBlogs';

export default function AdminDashboardPage() {
  const { data: productsData } = useAdminProducts({ limit: 1 });
  const { data: announcements } = useAnnouncements();
  const { data: carousel } = useCarousel();
  const { data: collectionsData } = useAdminCollections({ limit: 1 });
  const { data: blogsData } = useAdminBlogs({ limit: 1 });

  const stats = [
    { label: 'Total Products', value: productsData?.total || 0, icon: Package },
    { label: 'Total Collections', value: collectionsData?.total || 0, icon: Library },
    { label: 'Blog Posts', value: blogsData?.total || 0, icon: PenLine },
    { label: 'Active Announcements', value: announcements?.filter(a => a.isActive).length || 0, icon: Megaphone },
    { label: 'Carousel Images', value: carousel?.length || 0, icon: Images },
  ];

  return (
    <AdminProtectedRoute>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <AdminCard key={i} className="relative overflow-hidden">
              <Icon className="absolute top-4 right-4 text-olive/20 size-12" />
              <div className="relative z-10">
                <p className="font-montserrat text-xs uppercase tracking-wider text-forest/60 mb-1">{stat.label}</p>
                <p className="font-merriweather text-3xl text-forest">{stat.value}</p>
              </div>
            </AdminCard>
          );
        })}
      </div>

      <div className="flex gap-4 flex-wrap">
        <Link 
          href="/admin/products/new"
          className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-sm hover:bg-olive transition-colors"
        >
          Add Product
        </Link>
        <Link 
          href="/admin/blogs/new"
          className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-sm hover:bg-olive transition-colors"
        >
          New Blog Post
        </Link>
        <Link 
          href="/admin/announcements"
          className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-sm hover:bg-olive transition-colors"
        >
          Edit Announcement
        </Link>
        <Link 
          href="/admin/carousel"
          className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-sm hover:bg-olive transition-colors"
        >
          Update Carousel
        </Link>
      </div>
    </AdminProtectedRoute>
  );
}
