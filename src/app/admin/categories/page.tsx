'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import DataTable, { ColumnDef } from '@/components/admin/ui/DataTable';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import { useAdminCategories, useDeleteCategory } from '@/hooks/admin/useAdminCategories';
import { AdminCategory } from '@/types/admin';
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

export default function AdminCategoriesPage() {
  const { data, isLoading } = useAdminCategories();
  const deleteMutation = useDeleteCategory();
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const columns: ColumnDef<AdminCategory>[] = [
    {
      key: 'image',
      header: 'Cover Image',
      width: '80px',
      render: (category) => {
        return category.image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={category.image.url} alt={category.name} className="w-12 h-12 object-cover rounded-sm border border-olive/15" />
        ) : (
          <div className="w-12 h-12 bg-warm rounded-sm border border-olive/15 flex items-center justify-center text-[10px] text-forest/40 text-center leading-tight">
            No image
          </div>
        );
      }
    },
    {
      key: 'name',
      header: 'Name',
      render: (category) => <span className="font-merriweather text-sm text-forest font-semibold">{category.name}</span>
    },
    {
      key: 'slug',
      header: 'Slug',
      render: (category) => <span className="font-montserrat text-xs text-forest/70">{category.slug}</span>
    },
    {
      key: 'isFeatured',
      header: 'Featured',
      render: (category) => (
        category.isFeatured ? (
          <span className="inline-block bg-olive/10 text-olive border border-olive/20 font-montserrat text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
            Featured
          </span>
        ) : (
          <span className="inline-block bg-black/5 text-forest/50 font-montserrat text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
            Standard
          </span>
        )
      )
    },
    {
      key: 'actions',
      header: '',
      width: '100px',
      render: (category) => (
        <div className="flex items-center gap-3 justify-end">
          <Link href={`/admin/categories/${category._id}/edit`} className="text-olive hover:text-forest transition-colors">
            <Pencil className="size-4" />
          </Link>
          <AlertDialog>
            <AlertDialogTrigger>
              <div 
                onClick={() => setCategoryToDelete(category._id)}
                className="text-copper hover:text-red-500 transition-colors"
              >
                <Trash2 className="size-4" />
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-olive/20">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-merriweather text-forest">Delete {category.name}?</AlertDialogTitle>
                <AlertDialogDescription className="font-montserrat text-sm text-forest/60">
                  This will permanently delete the category and its cover image. Products in this category won't be deleted, but they might not show up in category filters.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-montserrat text-xs uppercase tracking-wider">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => {
                    if (categoryToDelete) {
                      deleteMutation.mutate(categoryToDelete);
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
        <h1 className="font-merriweather text-2xl text-forest">Categories</h1>
        <Link 
          href="/admin/categories/new"
          className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-sm hover:bg-olive transition-colors"
        >
          Add Category
        </Link>
      </div>
      
      <DataTable 
        columns={columns} 
        data={data?.categories || []} 
        isLoading={isLoading} 
        emptyMessage="No categories found."
      />
    </AdminProtectedRoute>
  );
}
