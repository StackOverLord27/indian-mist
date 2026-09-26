'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import { useAdminProducts, useDeleteProduct, useReorderProducts } from '@/hooks/admin/useAdminProducts';
import { AdminProduct } from '@/types/admin';
import { ArrowUp, ArrowDown, Pencil, Trash2, Loader2 } from 'lucide-react';
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
  const { data, isLoading } = useAdminProducts({ limit: 200 });
  const deleteMutation = useDeleteProduct();
  const reorderMutation = useReorderProducts();
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  
  // Drag and drop state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const products: AdminProduct[] = data?.products || [];

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= products.length) return;
    const newOrder = [...products];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);
    reorderMutation.mutate(newOrder.map(p => p._id));
  };

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

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-olive" /></div>
      ) : (
        <div className="bg-card rounded-md border border-olive/15 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[40px_56px_1fr_120px_100px_80px_100px] items-center px-4 py-2.5 border-b border-olive/15 bg-warm/30">
            <span className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60">#</span>
            <span className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60">Img</span>
            <span className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60">Name</span>
            <span className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60">Category</span>
            <span className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60">Price</span>
            <span className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60">Status</span>
            <span className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60 text-right">Actions</span>
          </div>

          {products.length === 0 && (
            <p className="text-center font-montserrat text-sm text-forest/50 py-10">No products found.</p>
          )}

          {products.map((product, idx) => {
            const primaryImage = product.images?.find(img => img.isPrimary) || product.images?.[0];
            const isDragging = draggedIdx === idx;
            const isDragOver = dragOverIdx === idx;
            
            return (
              <div
                key={product._id}
                draggable={!reorderMutation.isPending}
                onDragStart={(e) => {
                  setDraggedIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
                  // Transparent image to hide default drag ghost if desired, but default is fine
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedIdx !== null && draggedIdx !== idx) {
                    setDragOverIdx(idx);
                  }
                }}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverIdx(null);
                  if (draggedIdx === null || draggedIdx === idx) return;
                  const newOrder = [...products];
                  const [moved] = newOrder.splice(draggedIdx, 1);
                  newOrder.splice(idx, 0, moved);
                  reorderMutation.mutate(newOrder.map(p => p._id));
                  setDraggedIdx(null);
                }}
                onDragEnd={() => {
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                }}
                className={`grid grid-cols-[40px_56px_1fr_120px_100px_80px_100px] items-center px-4 py-3 border-b border-olive/10 last:border-b-0 hover:bg-warm/20 transition-all group cursor-grab active:cursor-grabbing ${
                  isDragging ? 'opacity-50 scale-[0.99] bg-warm/40 shadow-inner' : ''
                } ${
                  isDragOver ? (draggedIdx! < idx ? 'border-b-2 border-b-olive/50' : 'border-t-2 border-t-olive/50') : ''
                }`}
              >
                {/* Order controls */}
                <div className="flex flex-col gap-0.5 cursor-pointer" onDragStart={e => e.preventDefault()} /* Prevent arrows from acting as drag targets individually */>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, 'up')}
                    disabled={idx === 0 || reorderMutation.isPending}
                    className="p-0.5 text-forest/30 hover:text-forest disabled:opacity-20 transition-colors"
                    title="Move up"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, 'down')}
                    disabled={idx === products.length - 1 || reorderMutation.isPending}
                    className="p-0.5 text-forest/30 hover:text-forest disabled:opacity-20 transition-colors"
                    title="Move down"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>

                {/* Image */}
                {primaryImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={primaryImage.url} alt={product.name} className="w-10 h-10 object-cover rounded-sm border border-olive/15" />
                ) : (
                  <div className="w-10 h-10 bg-warm rounded-sm border border-olive/15" />
                )}

                {/* Name */}
                <span className="font-merriweather text-sm text-forest truncate pr-4">{product.name}</span>

                {/* Category */}
                <span className="inline-block border border-olive/25 text-olive font-montserrat text-[10px] px-2 py-0.5 rounded-full w-fit">
                  {product.category}
                </span>

                {/* Price */}
                <span className="font-merriweather font-bold text-forest">₹{product.price.toLocaleString('en-IN')}</span>

                {/* Status */}
                <StatusBadge active={product.isActive ?? true} />

                {/* Actions */}
                <div className="flex items-center gap-3 justify-end">
                  <Link href={`/admin/products/${product._id}/edit`} className="text-olive hover:text-forest transition-colors">
                    <Pencil className="size-4" />
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger>
                      <div onClick={() => setProductToDelete(product._id)} className="text-copper hover:text-red-500 transition-colors">
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
                          onClick={() => { if (productToDelete) deleteMutation.mutate(productToDelete); }}
                          className="bg-copper text-white hover:bg-red-600 font-montserrat text-xs uppercase tracking-wider"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminProtectedRoute>
  );
}
