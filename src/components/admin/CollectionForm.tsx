'use client';

import type { Resolver } from 'react-hook-form';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AdminCollection, AdminProduct } from '@/types/admin';
import { useCreateCollection, useUpdateCollection } from '@/hooks/admin/useAdminCollections';
import ProductPicker from '@/components/admin/ProductPicker';
import { pickedFromCollection, type PickedProduct } from '@/lib/product-picker';
import AdminCard from '@/components/admin/ui/AdminCard';
import { Loader2 } from 'lucide-react';
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
  
  // Chosen products with enough detail to show them; an existing collection arrives populated
  const [selectedProducts, setSelectedProducts] = useState<PickedProduct[]>(() =>
    isEditing ? pickedFromCollection(initialData.products as (string | AdminProduct)[]) : []
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
      products: selectedProducts.map((p) => p._id),
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

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
            
            <ProductPicker selected={selectedProducts} onChange={setSelectedProducts} />
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
