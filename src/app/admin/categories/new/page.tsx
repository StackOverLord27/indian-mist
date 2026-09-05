'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import CategoryForm from '@/components/admin/categories/CategoryForm';

export default function NewCategoryPage() {
  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">Add New Category</h1>
      <CategoryForm />
    </AdminProtectedRoute>
  );
}
