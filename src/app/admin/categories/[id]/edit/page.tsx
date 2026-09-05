'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import CategoryForm from '@/components/admin/categories/CategoryForm';
import { useAdminCategory } from '@/hooks/admin/useAdminCategories';
import { Loader2 } from 'lucide-react';
import { use } from 'react';

export default function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: category, isLoading } = useAdminCategory(id);

  if (isLoading) {
    return (
      <AdminProtectedRoute>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="animate-spin text-forest size-8" />
        </div>
      </AdminProtectedRoute>
    );
  }

  if (!category) {
    return (
      <AdminProtectedRoute>
        <div className="flex h-[60vh] items-center justify-center font-montserrat text-forest">
          Category not found
        </div>
      </AdminProtectedRoute>
    );
  }

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">Edit Category: {category.name}</h1>
      <CategoryForm category={category} />
    </AdminProtectedRoute>
  );
}
