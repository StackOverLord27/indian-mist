'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import ProductForm from '@/components/admin/products/ProductForm';

export default function NewProductPage() {
  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">Add New Product</h1>
      <ProductForm />
    </AdminProtectedRoute>
  );
}
