'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import DataTable, { ColumnDef } from '@/components/admin/ui/DataTable';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import { useAdminCollections, useDeleteCollection } from '@/hooks/admin/useAdminCollections';
import { AdminCollection } from '@/types/admin';
import { Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from 'react';

export default function AdminCollectionsPage() {
  const { data, isLoading } = useAdminCollections();
  const deleteMutation = useDeleteCollection();
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);

  const columns: ColumnDef<AdminCollection>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (collection) => <span className="font-merriweather text-sm text-forest font-semibold">{collection.name}</span>
    },
    {
      key: 'slug',
      header: 'Slug',
      render: (collection) => <span className="font-montserrat text-xs text-forest/70">{collection.slug}</span>
    },
    {
      key: 'products',
      header: 'Products',
      render: (collection) => (
        <span className="font-montserrat text-xs text-forest/80">
          {collection.products?.length || 0} items
        </span>
      )
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (collection) => (
        <StatusBadge 
          active={collection.isActive} 
        />
      )
    },
    {
      key: 'actions',
      header: '',
      width: '100px',
      render: (collection) => (
        <div className="flex items-center gap-3 justify-end">
          <Link href={`/admin/collections/${collection._id}/edit`} className="text-olive hover:text-forest transition-colors">
            <Pencil className="size-4" />
          </Link>
          <AlertDialog>
            <AlertDialogTrigger>
              <div 
                onClick={() => setCollectionToDelete(collection._id)}
                className="text-copper hover:text-red-500 transition-colors cursor-pointer"
              >
                <Trash2 className="size-4" />
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-olive/20">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-merriweather text-forest">Delete {collection.name}?</AlertDialogTitle>
                <AlertDialogDescription className="font-montserrat text-sm text-forest/60">
                  This will permanently delete the collection. The products inside it will not be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-montserrat text-xs uppercase tracking-wider">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => {
                    if (collectionToDelete) {
                      deleteMutation.mutate(collectionToDelete);
                    }
                  }}
                  className="bg-copper text-white hover:bg-red-600 font-montserrat text-xs uppercase tracking-wider"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )
    }
  ];

  return (
    <AdminProtectedRoute>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-merriweather text-2xl text-forest">Collections</h1>
        <Link 
          href="/admin/collections/new"
          className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-sm hover:bg-olive transition-colors"
        >
          Add Collection
        </Link>
      </div>
      
      <DataTable 
        columns={columns} 
        data={data?.collections || []} 
        isLoading={isLoading} 
        emptyMessage="No collections found."
      />
    </AdminProtectedRoute>
  );
}
