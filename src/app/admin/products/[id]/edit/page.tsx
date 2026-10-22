'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import ProductForm from '@/components/admin/products/ProductForm';
import { useAdminProduct } from '@/hooks/admin/useAdminProducts';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function EditProductPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { data: product, isLoading } = useAdminProduct(id);

  return (
    <AdminProtectedRoute>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-merriweather text-2xl text-forest">Edit Product</h1>
        <button
          type="button"
          onClick={() => router.push(`/admin/products/new?duplicate=${id}`)}
          className="font-montserrat text-xs font-semibold uppercase tracking-wider px-4 py-2 border border-forest/20 text-forest rounded-sm hover:bg-forest hover:text-cornsilk transition-colors cursor-pointer"
        >
          Duplicate as new colour
        </button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-olive" />
        </div>
      ) : (
        <ProductForm product={product} />
      )}
    </AdminProtectedRoute>
  );
}
