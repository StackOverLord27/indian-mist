'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import ProductForm from '@/components/admin/products/ProductForm';
import { useAdminProduct } from '@/hooks/admin/useAdminProducts';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function EditProductPage() {
  const { id } = useParams() as { id: string };
  const { data: product, isLoading } = useAdminProduct(id);

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">Edit Product</h1>
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
