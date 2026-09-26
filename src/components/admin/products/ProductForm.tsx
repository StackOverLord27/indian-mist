/* eslint-disable react-hooks/incompatible-library */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AdminFormField, { inputClass } from '@/components/admin/ui/AdminFormField';
import ImageUploadZone from '@/components/admin/ui/ImageUploadZone';
import { AdminProduct } from '@/types/admin';
import { Loader2, X } from 'lucide-react';
import { useCreateProduct, useUpdateProduct } from '@/hooks/admin/useAdminProducts';
import { useAdminCategories } from '@/hooks/admin/useAdminCategories';
import * as categoryApi from '@/lib/admin-api/categories';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const materialSchema = z.object({
  name: z.string().min(1, 'Material name is required'),
  percentage: z.number().min(0).max(100, 'Must be between 0 and 100'),
  origin: z.string().min(1, 'Origin is required'),
});

const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(120),
  category: z.string().min(1, 'Category is required'),
  price: z.number().positive('Price must be positive'),
  originalPrice: z.number().positive().optional().or(z.literal(0)),
  description: z.string().min(10, 'Description is too short'),
  features: z.array(z.string()),
  sizes: z.array(z.string()).optional(),
  tags: z.string(), // We will handle array conversion manually or let hook form handle it
  badge: z.enum(['New', 'Sale', '']).optional(),
  isFeatured: z.boolean().default(false),
  materials: z.array(materialSchema),
});

type ProductFormData = z.infer<typeof productSchema>;

const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export default function ProductForm({ product }: { product?: AdminProduct }) {
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct(product?._id || '');
  
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [coverImageId, setCoverImageId] = useState<string>('');
  // Track image display order — publicId array; first item = primary
  const [imageOrder, setImageOrder] = useState<string[]>([]);
  
  const { data: categoriesData, isLoading: isLoadingCategories } = useAdminCategories({ limit: 100 });
  const queryClient = useQueryClient();
  
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const inlineCreateCategory = useMutation({
    mutationFn: categoryApi.createCategory,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setValue('category', data.slug);
      toast.success('Category added');
      setIsCreatingCategory(false);
      setNewCategoryName('');
    }
  });

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    const formData = new FormData();
    formData.append('name', newCategoryName.trim());
    inlineCreateCategory.mutate(formData);
  };
  
  useEffect(() => {
    if (product?.images) {
      const cImg = product.images.find(img => img.isCategoryCover);
      if (cImg) setCoverImageId(cImg.publicId);
      // Initialise order to existing array order; primary is always first
      const sorted = [...product.images].sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0));
      setImageOrder(sorted.map(img => img.publicId));
    }
  }, [product]);

  const { register, control, handleSubmit, formState: { errors, isDirty }, setValue, watch } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      name: product?.name || '',
      category: product?.category || '',
      price: product?.price || 0,
      originalPrice: product?.originalPrice || 0,
      description: product?.description || '',
      features: product?.features || [''],
      sizes: product?.sizes || [],
      tags: product?.tags?.join(', ') || '',
      badge: product?.badge || '',
      isFeatured: product?.isFeatured || false,
      materials: product?.materials || [{ name: '', percentage: 0, origin: '' }],
    }
  });

  const { fields: featureFields, append: appendFeature, remove: removeFeature } = useFieldArray({
    control,
    name: 'features' as never,
  });

  const { fields: materialFields, append: appendMaterial, remove: removeMaterial } = useFieldArray({
    control,
    name: 'materials' as never,
  });

  const onSubmit = async (data: ProductFormData) => {
    const formData = new FormData();
    
    // Append scalar fields
    formData.append('name', data.name);
    formData.append('category', data.category);
    formData.append('price', data.price.toString());
    if (data.originalPrice) formData.append('originalPrice', data.originalPrice.toString());
    formData.append('description', data.description);
    if (data.badge) formData.append('badge', data.badge);
    formData.append('isFeatured', data.isFeatured ? 'true' : 'false');
    
    // Arrays need special handling or JSON stringification
    formData.append('features', JSON.stringify(data.features));
    if (data.sizes) formData.append('sizes', JSON.stringify(data.sizes));
    formData.append('tags', JSON.stringify(data.tags.split(',').map(t => t.trim()).filter(Boolean)));
    formData.append('materials', JSON.stringify(data.materials));
    
    // Image handling
    newFiles.forEach(file => {
      formData.append('images', file);
    });
    
    if (removedImageIds.length > 0) {
      formData.append('removedImageIds', JSON.stringify(removedImageIds));
    }
    
    // First image in imageOrder is primary
    if (imageOrder.length > 0) {
      formData.append('primaryImageId', imageOrder[0]);
      formData.append('imageOrder', JSON.stringify(imageOrder));
    }
    if (coverImageId) formData.append('coverImageId', coverImageId);

    if (product) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const currentImages = product?.images
    ?.filter(img => !removedImageIds.includes(img.publicId))
    .sort((a, b) => {
      const ai = imageOrder.indexOf(a.publicId);
      const bi = imageOrder.indexOf(b.publicId);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .map((img, idx) => ({
      ...img,
      isPrimary: idx === 0, // first in sorted order is always primary
      isCategoryCover: img.publicId === coverImageId,
    })) || [];

  const handleRemoveExisting = (publicId: string) => {
    setRemovedImageIds(prev => [...prev, publicId]);
    setImageOrder(prev => prev.filter(id => id !== publicId));
    if (coverImageId === publicId) setCoverImageId('');
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <AdminFormField label="Product Name" required error={errors.name?.message}>
              <input {...register('name')} className={inputClass} placeholder="e.g. Olive Leaf Tea" />
            </AdminFormField>
            <AdminFormField label="Category" required error={errors.category?.message}>
              {isCreatingCategory ? (
                <div className="flex gap-2">
                  <input 
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className={inputClass}
                    placeholder="New category name"
                    autoFocus
                  />
                  <button 
                    type="button" 
                    onClick={handleCreateCategory}
                    disabled={inlineCreateCategory.isPending}
                    className="bg-forest text-cornsilk px-3 py-1.5 rounded-sm text-xs font-semibold uppercase hover:bg-olive transition-colors disabled:opacity-50 flex items-center justify-center min-w-16"
                  >
                    {inlineCreateCategory.isPending ? <Loader2 className="animate-spin size-4" /> : 'Add'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsCreatingCategory(false)}
                    className="p-2 text-copper hover:bg-copper/10 rounded-sm"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select onValueChange={(val) => { if (val) setValue('category', val) }} value={watch('category') || undefined}>
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder={isLoadingCategories ? "Loading..." : "Select category"} />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesData?.categories.map((cat) => (
                          <SelectItem key={cat._id} value={cat.slug}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setIsCreatingCategory(true)}
                    className="px-3 py-1.5 text-forest border border-forest/20 rounded-sm text-xs font-semibold uppercase hover:bg-forest hover:text-cornsilk transition-colors"
                  >
                    New
                  </button>
                </div>
              )}
            </AdminFormField>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <AdminFormField label="Price" required error={errors.price?.message}>
              <input type="number" step="0.01" {...register('price', { valueAsNumber: true })} className={inputClass} />
            </AdminFormField>
            <AdminFormField label="Original Price" error={errors.originalPrice?.message}>
              <input type="number" step="0.01" {...register('originalPrice', { valueAsNumber: true })} className={inputClass} />
            </AdminFormField>
            <AdminFormField label="Badge" error={errors.badge?.message}>
              <Select onValueChange={(val: any) => setValue('badge', val)} defaultValue={product?.badge || ''}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Sale">Sale</SelectItem>
                </SelectContent>
              </Select>
            </AdminFormField>
          </div>

          <div className="flex items-center space-x-2 py-2">
            <Checkbox 
              id="isFeatured" 
              checked={watch('isFeatured')}
              onCheckedChange={(checked) => setValue('isFeatured', !!checked, { shouldDirty: true })}
            />
            <label htmlFor="isFeatured" className="font-montserrat text-sm font-medium text-forest cursor-pointer">
              Feature this product on the Homepage
            </label>
          </div>

          <AdminFormField label="Description" required error={errors.description?.message}>
            <textarea {...register('description')} className={`${inputClass} resize-none h-28`} />
          </AdminFormField>

          {/* Features */}
          <div>
            <label className="block font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-1.5">Features</label>
            {featureFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 mb-2">
                <input {...register(`features.${index}` as const)} className={inputClass} placeholder="e.g. Hand-picked from Assam" />
                <button type="button" onClick={() => removeFeature(index)} className="p-2 text-copper hover:bg-copper/10 rounded-sm">
                  <X className="size-5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => appendFeature('')} className="text-xs font-montserrat text-olive hover:underline">
              + Add Feature
            </button>
          </div>

          {/* Sizes */}
          <AdminFormField label="Available Sizes">
            <div className="flex gap-4">
              {ALL_SIZES.map(size => (
                <div key={size} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`size-${size}`} 
                    onCheckedChange={(checked) => {
                      const current = watch('sizes') || [];
                      if (checked) setValue('sizes', [...current, size]);
                      else setValue('sizes', current.filter(s => s !== size));
                    }}
                    checked={(watch('sizes') || []).includes(size)}
                  />
                  <label htmlFor={`size-${size}`} className="font-montserrat text-sm">{size}</label>
                </div>
              ))}
            </div>
          </AdminFormField>

          <AdminFormField label="Tags (comma separated)" error={errors.tags?.message}>
            <input {...register('tags')} className={inputClass} placeholder="organic, fresh, limited" />
          </AdminFormField>

          {/* Materials */}
          <div>
            <label className="block font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-1.5">Materials / Ingredients</label>
            {materialFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 mb-2">
                <input {...register(`materials.${index}.name` as const)} className={`${inputClass} w-2/5`} placeholder="Name" />
                <input type="number" {...register(`materials.${index}.percentage` as const, { valueAsNumber: true })} className={`${inputClass} w-1/5`} placeholder="%" />
                <input {...register(`materials.${index}.origin` as const)} className={`${inputClass} w-2/5`} placeholder="Origin" />
                <button type="button" onClick={() => removeMaterial(index)} className="p-2 text-copper hover:bg-copper/10 rounded-sm">
                  <X className="size-5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => appendMaterial({ name: '', percentage: 0, origin: '' })} className="text-xs font-montserrat text-olive hover:underline">
              + Add Material
            </button>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1 space-y-6">
          <div>
            <label className="block font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-1.5">Product Images</label>
            <ImageUploadZone 
              multiple={true}
              maxFiles={10}
              currentImages={currentImages}
              onRemoveExisting={handleRemoveExisting}
              onReorderImages={setImageOrder}
              onSetCategoryCover={setCoverImageId}
              showCategoryCoverOption={true}
              onFilesSelected={setNewFiles}
            />
          </div>
          <div className="bg-warm border border-olive/15 rounded-sm p-3 font-montserrat text-xs text-forest/60">
            Use ↑↓ arrows to reorder images. The <strong>first image</strong> is always shown as Primary on the storefront.
            The Cover image appears on the category browse grid.
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-60 right-0 bg-card border-t border-olive/10 px-6 py-4 flex justify-between items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div>
          {isDirty && <span className="font-montserrat text-xs text-forest/60">Unsaved changes</span>}
        </div>
        <div className="flex gap-4">
          <button type="button" className="font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 text-forest hover:bg-black/5 rounded-sm transition-colors">
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isPending}
            className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-sm hover:bg-olive transition-colors flex items-center justify-center min-w-30"
          >
            {isPending ? <Loader2 className="animate-spin size-4" /> : (product ? 'Save Changes' : 'Create Product')}
          </button>
        </div>
      </div>
    </form>
  );
}
