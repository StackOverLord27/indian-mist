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
import { useUnmatchedPayments } from '@/hooks/admin/useUnmatchedPayments';

export default function AdminDashboardPage() {
  const { data: productsData } = useAdminProducts({ limit: 1 });
  const { data: announcements } = useAnnouncements();
  const { data: carousel } = useCarousel();
  const { data: collectionsData } = useAdminCollections({ limit: 1 });
  const { data: blogsData } = useAdminBlogs({ limit: 1 });
  const { data: unmatched } = useUnmatchedPayments();

  const stats = [
    { label: 'Total Products', value: productsData?.total || 0, icon: Package },
    { label: 'Total Collections', value: collectionsData?.total || 0, icon: Library },
    { label: 'Blog Posts', value: blogsData?.total || 0, icon: PenLine },
    { label: 'Active Announcements', value: announcements?.filter(a => a.isActive).length || 0, icon: Megaphone },
    { label: 'Carousel Images', value: carousel?.length || 0, icon: Images },
  ];

  return (
    <AdminProtectedRoute>
      {!!unmatched?.count && (
        <div role="alert" className="mb-6 rounded-md border border-red-300 bg-red-50 p-5 text-red-900">
          <h3 className="font-serif text-base">
            {unmatched.count} payment{unmatched.count === 1 ? '' : 's'} received without an order
          </h3>
          <p className="font-sans text-xs mt-1 mb-3">
            Razorpay confirmed these payments but the checkout session had expired, so no order exists. Find each one in the
            Razorpay dashboard (search the payment id), then either create the order by hand or refund it. A row disappears
            by itself if an order for it appears later.
          </p>
          <ul className="space-y-1 font-sans text-xs">
            {unmatched.payments.map((p) => (
              <li key={p._id} className="flex flex-wrap gap-x-4 gap-y-0.5 border-t border-red-200 pt-1">
                <span>Payment <b>{p.razorpayPaymentId}</b></span>
                <span>Order {p.razorpayOrderId}</span>
                {p.amount !== undefined && <span>₹{p.amount.toFixed(2)}</span>}
                <span>{new Date(p.createdAt).toLocaleString()}</span>
                <span>via {p.source === 'webhook' ? 'Razorpay webhook' : 'customer\'s browser'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
