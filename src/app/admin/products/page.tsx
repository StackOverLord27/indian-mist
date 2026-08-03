'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import DataTable, { ColumnDef } from '@/components/admin/ui/DataTable';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import { useAdminProducts, useDeleteProduct } from '@/hooks/admin/useAdminProducts';
import { AdminProduct } from '@/types/admin';
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

export default function AdminProductsPage() {
  const { data, isLoading } = useAdminProducts();
  const deleteMutation = useDeleteProduct();
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const columns: ColumnDef<AdminProduct>[] = [
    {
      key: 'image',
      header: 'Image',
      width: '60px',
      render: (product) => {
        const primaryImage = product.images?.find(img => img.isPrimary) || product.images?.[0];
        return primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={primaryImage.url} alt={product.name} className="w-10 h-10 object-cover rounded-sm border border-olive/15" />
        ) : (
          <div className="w-10 h-10 bg-warm rounded-sm border border-olive/15" />
        );
      }
    },
    {
      key: 'name',
      header: 'Name',
      render: (product) => <span className="font-merriweather text-sm text-forest">{product.name}</span>
    },
    {
      key: 'category',
      header: 'Category',
      render: (product) => (
        <span className="inline-block border border-olive/25 text-olive font-montserrat text-[10px] px-2 py-0.5 rounded-full">
          {product.category}
        </span>
      )
    },
    {
      key: 'price',
      header: 'Price',
      render: (product) => <span className="font-merriweather font-bold text-forest">${product.price.toFixed(2)}</span>
    },
    {
      key: 'status',
      header: 'Status',
      render: (product) => <StatusBadge active={product.isActive ?? true} />
    },
    {
      key: 'actions',
      header: '',
      width: '100px',
      render: (product) => (
        <div className="flex items-center gap-3 justify-end">
          <Link href={`/admin/products/${product._id}/edit`} className="text-olive hover:text-forest transition-colors">
            <Pencil className="size-4" />
          </Link>
          <AlertDialog>
            <AlertDialogTrigger>
              <div 
                onClick={() => setProductToDelete(product._id)}
                className="text-copper hover:text-red-500 transition-colors"
              >
                <Trash2 className="size-4" />
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-olive/20">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-merriweather text-forest">Delete {product.name}?</AlertDialogTitle>
                <AlertDialogDescription className="font-montserrat text-sm text-forest/60">
                  This will permanently delete the product and all its images from cloud storage.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-montserrat text-xs uppercase tracking-wider">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => {
                    if (productToDelete) {
                      deleteMutation.mutate(productToDelete);
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
        <h1 className="font-merriweather text-2xl text-forest">Products</h1>
        <Link 
          href="/admin/products/new"
          className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-sm hover:bg-olive transition-colors"
        >
          Add Product
        </Link>
      </div>
      
      <DataTable 
        columns={columns} 
        data={data?.products || []} 
        isLoading={isLoading} 
        emptyMessage="No products found."
      />
    </AdminProtectedRoute>
  );
}
