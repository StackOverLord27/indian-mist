'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import ProductForm from '@/components/admin/products/ProductForm';
import { useAdminProduct } from '@/hooks/admin/useAdminProducts';

function NewProductContent() {
  const duplicateId = useSearchParams().get('duplicate') ?? '';
  const { data: source, isLoading } = useAdminProduct(duplicateId);

  if (duplicateId && isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-olive" />
      </div>
    );
  }
  return <ProductForm duplicateOf={source} />;
}

export default function NewProductPage() {
  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">Add New Product</h1>
      <Suspense>
        <NewProductContent />
      </Suspense>
    </AdminProtectedRoute>
  );
}
