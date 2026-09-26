'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import CollectionForm from '@/components/admin/CollectionForm';
import { useAdminCollection } from '@/hooks/admin/useAdminCollections';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function EditCollectionPage() {
  const params = useParams();
  const { data: collection, isLoading } = useAdminCollection(params.id as string);

  if (isLoading) {
    return (
      <AdminProtectedRoute>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-olive" />
        </div>
      </AdminProtectedRoute>
    );
  }

  if (!collection) {
    return (
      <AdminProtectedRoute>
        <div className="text-center text-forest mt-12 font-montserrat">
          Collection not found.
        </div>
      </AdminProtectedRoute>
    );
  }

  return (
    <AdminProtectedRoute>
      <CollectionForm initialData={collection} />
    </AdminProtectedRoute>
  );
}
