 
'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AdminFormField, { inputClass } from '@/components/admin/ui/AdminFormField';
import ImageUploadZone from '@/components/admin/ui/ImageUploadZone';
import { AdminCategory } from '@/types/admin';
import { Loader2 } from 'lucide-react';
import { useCreateCategory, useUpdateCategory } from '@/hooks/admin/useAdminCategories';
import { Switch } from "@/components/ui/switch";

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  isFeatured: z.boolean(),
  isHidden: z.boolean(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function CategoryForm({ category }: { category?: AdminCategory }) {
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory(category?._id || '');
  
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [removedImageId, setRemovedImageId] = useState<string | null>(null);
  
  const { register, control, handleSubmit, formState: { errors, isDirty } } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name || '',
      description: category?.description || '',
      isFeatured: category?.isFeatured || false,
      isHidden: category?.isHidden || false,
    }
  });

  const onSubmit = async (data: CategoryFormData) => {
    const formData = new FormData();
    
    formData.append('name', data.name);
    if (data.description) formData.append('description', data.description);
    formData.append('isFeatured', data.isFeatured.toString());
    formData.append('isHidden', data.isHidden.toString());
    
    if (newFiles.length > 0) {
      formData.append('images', newFiles[0]); // Only one image for category
    }
    
    if (removedImageId) {
      formData.append('removedImageId', removedImageId);
    }
    
    if (category) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const currentImages = category?.image && removedImageId !== category.image.publicId 
    ? [{ 
        ...category.image, 
        isPrimary: true 
      }] 
    : [];

  const handleRemoveExisting = (publicId: string) => {
    setRemovedImageId(publicId);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <AdminFormField label="Category Name" required error={errors.name?.message}>
            <input {...register('name')} className={inputClass} placeholder="e.g. Wellness" />
          </AdminFormField>
          
          <AdminFormField label="Description" error={errors.description?.message}>
            <textarea {...register('description')} className={`${inputClass} resize-none h-28`} placeholder="Optional category description" />
          </AdminFormField>

          <AdminFormField label="Visibility">
            <div className="flex flex-col gap-3">
              <div className="flex items-center space-x-2 bg-warm p-4 border border-olive/15 rounded-sm">
                <Controller
                  name="isFeatured"
                  control={control}
                  render={({ field }) => (
                    <Switch 
                      id="isFeatured" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="isFeatured"
                    className="font-montserrat text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-forest"
                  >
                    Featured on Homepage
                  </label>
                  <p className="font-montserrat text-xs text-forest/60">
                    If checked, this category will appear more prominently on the homepage grid.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 bg-warm p-4 border border-olive/15 rounded-sm">
                <Controller
                  name="isHidden"
                  control={control}
                  render={({ field }) => (
                    <Switch 
                      id="isHidden" 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="isHidden"
                    className="font-montserrat text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-forest"
                  >
                    Hide Category
                  </label>
                  <p className="font-montserrat text-xs text-forest/60">
                    If checked, this category will not appear on the homepage grid.
                  </p>
                </div>
              </div>
            </div>
          </AdminFormField>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1 space-y-6">
          <div>
            <label className="block font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-1.5">Category Cover Image</label>
            <ImageUploadZone 
              hint="Normal category: 1200 × 1200 px (square). Featured category (wide banner card, 2:1): 1800 × 900 px. Keep the subject in the centre."
              multiple={false}
              maxFiles={1}
              currentImages={currentImages}
              onRemoveExisting={handleRemoveExisting}
              onFilesSelected={(files) => setNewFiles(files)}
            />
          </div>
          <div className="bg-warm border border-olive/15 rounded-sm p-3 font-montserrat text-xs text-forest/60">
            This image represents the category on the homepage and any category listings. Use a high-quality, relevant photo.
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-60 right-0 bg-card border-t border-olive/10 px-6 py-4 flex justify-between items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div>
          {isDirty && <span className="font-montserrat text-xs text-forest/60">Unsaved changes</span>}
        </div>
        <div className="flex gap-4">
          <button type="button" onClick={() => window.history.back()} className="font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 text-forest hover:bg-black/5 rounded-sm transition-colors">
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isPending}
            className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-sm hover:bg-olive transition-colors flex items-center justify-center min-w-30"
          >
            {isPending ? <Loader2 className="animate-spin size-4" /> : (category ? 'Save Changes' : 'Create Category')}
          </button>
        </div>
      </div>
    </form>
  );
}
