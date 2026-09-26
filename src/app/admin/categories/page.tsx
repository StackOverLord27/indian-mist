'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { useAdminCategories, useDeleteCategory, useReorderCategories } from '@/hooks/admin/useAdminCategories';
import { AdminCategory } from '@/types/admin';
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

export default function AdminCategoriesPage() {
  const { data, isLoading } = useAdminCategories({ limit: 100 });
  const deleteMutation = useDeleteCategory();
  const reorderMutation = useReorderCategories();
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  // Drag and drop state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const categories: AdminCategory[] = data?.categories || [];

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    const newOrder = [...categories];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);
    reorderMutation.mutate(newOrder.map(c => c._id));
  };

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

      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-olive" /></div>
      ) : (
        <div className="bg-card rounded-md border border-olive/15 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[40px_80px_1fr_120px_80px_100px] items-center px-4 py-2.5 border-b border-olive/15 bg-warm/30">
            <span className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60">#</span>
            <span className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60">Image</span>
            <span className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60">Name</span>
            <span className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60">Slug</span>
            <span className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60">Featured</span>
            <span className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60 text-right">Actions</span>
          </div>

          {categories.length === 0 && (
            <p className="text-center font-montserrat text-sm text-forest/50 py-10">No categories found.</p>
          )}

          {categories.map((category, idx) => {
            const isDragging = draggedIdx === idx;
            const isDragOver = dragOverIdx === idx;
            
            return (
              <div
                key={category._id}
                draggable={!reorderMutation.isPending}
                onDragStart={(e) => {
                  setDraggedIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
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
                  const newOrder = [...categories];
                  const [moved] = newOrder.splice(draggedIdx, 1);
                  newOrder.splice(idx, 0, moved);
                  reorderMutation.mutate(newOrder.map(c => c._id));
                  setDraggedIdx(null);
                }}
                onDragEnd={() => {
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                }}
                className={`grid grid-cols-[40px_80px_1fr_120px_80px_100px] items-center px-4 py-3 border-b border-olive/10 last:border-b-0 hover:bg-warm/20 transition-all cursor-grab active:cursor-grabbing ${
                  isDragging ? 'opacity-50 scale-[0.99] bg-warm/40 shadow-inner' : ''
                } ${
                  isDragOver ? (draggedIdx! < idx ? 'border-b-2 border-b-olive/50' : 'border-t-2 border-t-olive/50') : ''
                }`}
              >
                {/* Order controls */}
                <div className="flex flex-col gap-0.5 cursor-pointer" onDragStart={e => e.preventDefault()}>
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
                  disabled={idx === categories.length - 1 || reorderMutation.isPending}
                  className="p-0.5 text-forest/30 hover:text-forest disabled:opacity-20 transition-colors"
                  title="Move down"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>

              {/* Image */}
              {category.image?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={category.image.url} alt={category.name} className="w-12 h-12 object-cover rounded-sm border border-olive/15" />
              ) : (
                <div className="w-12 h-12 bg-warm rounded-sm border border-olive/15 flex items-center justify-center text-[10px] text-forest/40 text-center leading-tight">
                  No img
                </div>
              )}

              {/* Name */}
              <span className="font-merriweather text-sm text-forest font-semibold truncate pr-4">{category.name}</span>

              {/* Slug */}
              <span className="font-montserrat text-xs text-forest/70 truncate">{category.slug}</span>

              {/* Featured badge */}
              {category.isFeatured ? (
                <span className="inline-block bg-olive/10 text-olive border border-olive/20 font-montserrat text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold w-fit">
                  Featured
                </span>
              ) : (
                <span className="inline-block bg-black/5 text-forest/50 font-montserrat text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider w-fit">
                  Standard
                </span>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 justify-end">
                <Link href={`/admin/categories/${category._id}/edit`} className="text-olive hover:text-forest transition-colors">
                  <Pencil className="size-4" />
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger>
                    <div onClick={() => setCategoryToDelete(category._id)} className="text-copper hover:text-red-500 transition-colors">
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
                        onClick={() => { if (categoryToDelete) deleteMutation.mutate(categoryToDelete); }}
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
