import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import CollectionForm from '@/components/admin/CollectionForm';

export default function NewCollectionPage() {
  return (
    <AdminProtectedRoute>
      <CollectionForm />
    </AdminProtectedRoute>
  );
}
