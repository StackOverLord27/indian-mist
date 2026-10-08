'use client';

import type { Resolver } from 'react-hook-form';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AdminCollection, AdminProduct } from '@/types/admin';
import { useCreateCollection, useUpdateCollection } from '@/hooks/admin/useAdminCollections';
import { useAdminProducts } from '@/hooks/admin/useAdminProducts';
import AdminCard from '@/components/admin/ui/AdminCard';
import { Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { CollectionSchema } from '@/schemas/admin';

type CollectionFormData = z.infer<typeof CollectionSchema>;

interface CollectionFormProps {
  initialData?: AdminCollection;
}

export default function CollectionForm({ initialData }: CollectionFormProps) {
  const isEditing = !!initialData;
  const createMutation = useCreateCollection();
  const updateMutation = useUpdateCollection(initialData?._id || '');
  
  const { data: productsData } = useAdminProducts({ limit: 1000 }); // fetch all for simple selection
  const availableProducts = productsData?.products || [];

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    isEditing 
      ? (initialData.products as (string | { _id: string })[]).map((p) => (typeof p === 'string' ? p : p._id))
      : []
  );

  const { register, handleSubmit, formState: { errors } } = useForm<CollectionFormData>({
    resolver: zodResolver(CollectionSchema) as Resolver<CollectionFormData>,
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      isActive: initialData?.isActive ?? true,
      order: initialData?.order ?? 0,
    }
  });

  const onSubmit = (data: CollectionFormData) => {
    const payload = {
      ...data,
      products: selectedProductIds,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-merriweather text-2xl text-forest">
          {isEditing ? 'Edit Collection' : 'Create Collection'}
        </h1>
        <button
          type="submit"
          disabled={isPending}
          className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-3 rounded-sm hover:bg-olive transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isEditing ? 'Save Changes' : 'Create Collection'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <AdminCard>
            <h2 className="font-merriweather text-lg text-forest mb-4">General Information</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-forest font-montserrat">Collection Name</label>
                <input
                  type="text"
                  {...register('name')}
                  placeholder="e.g., Summer Essentials"
                  className="w-full px-3 py-2 bg-transparent border border-olive/30 rounded-sm focus:outline-none focus:border-olive text-forest font-montserrat text-sm"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-forest font-montserrat">Description</label>
                <textarea
                  {...register('description')}
                  rows={4}
                  className="w-full px-3 py-2 bg-transparent border border-olive/30 rounded-sm focus:outline-none focus:border-olive text-forest font-montserrat text-sm"
                  placeholder="Describe this collection..."
                />
              </div>
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="font-merriweather text-lg text-forest mb-4">Products in Collection</h2>
            <p className="font-montserrat text-xs text-forest/70 mb-4">Select products to include in this collection.</p>
            
            <div className="max-h-96 overflow-y-auto border border-olive/20 rounded-sm divide-y divide-olive/10">
              {availableProducts.map((product) => {
                const isSelected = selectedProductIds.includes(product._id);
                return (
                  <div 
                    key={product._id} 
                    onClick={() => toggleProduct(product._id)}
                    className={`flex items-center gap-4 p-3 cursor-pointer transition-colors ${isSelected ? 'bg-olive/10' : 'hover:bg-white/40'}`}
                  >
                    <div className="w-12 h-12 flex-shrink-0 rounded-sm border border-olive/15 overflow-hidden flex items-center justify-center bg-white">
                      {product.images?.[0]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-forest/40">No img</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-merriweather text-sm text-forest font-semibold">{product.name}</p>
                      <p className="font-montserrat text-xs text-forest/60">{product.category}</p>
                    </div>
                    <div className="w-6 h-6 border rounded-sm flex items-center justify-center border-olive/30 text-olive">
                      {isSelected && <Plus className="size-4 rotate-45" />}
                    </div>
                  </div>
                );
              })}
              {availableProducts.length === 0 && (
                <div className="p-4 text-center font-montserrat text-sm text-forest/50">
                  No products available.
                </div>
              )}
            </div>
          </AdminCard>
        </div>

        <div className="space-y-6">
          <AdminCard>
            <h2 className="font-merriweather text-lg text-forest mb-4">Status</h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('isActive')}
                className="w-4 h-4 rounded border-olive/30 text-olive focus:ring-olive bg-transparent"
              />
              <span className="font-montserrat text-sm text-forest">Active</span>
            </label>
            <p className="font-montserrat text-xs text-forest/60 mt-2">
              If inactive, this collection won't appear on the storefront.
            </p>
          </AdminCard>

          <AdminCard>
            <h2 className="font-merriweather text-lg text-forest mb-3">Display Order</h2>
            <p className="font-montserrat text-xs text-forest/60 mb-3">
              Lower numbers appear first. Controls the numbering (01, 02…) shown on the collections page.
            </p>
            <input
              type="number"
              min={0}
              {...register('order', { valueAsNumber: true })}
              className="w-full px-3 py-2 bg-transparent border border-olive/30 rounded-sm focus:outline-none focus:border-olive text-forest font-montserrat text-sm"
            />
          </AdminCard>
        </div>
      </div>
    </form>
  );
}
