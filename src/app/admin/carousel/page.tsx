'use client';

import type { CarouselImage } from '@/types/admin';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import ImageUploadZone from '@/components/admin/ui/ImageUploadZone';
import { useCarousel, useAddCarouselImage, useDeleteCarouselImage, useReorderCarousel, useUpdateCarouselItem } from '@/hooks/admin/useAdminCarousel';
import { ArrowUp, ArrowDown, Pencil, Eye, EyeOff, Trash2, Loader2, Check, X } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

export default function AdminCarouselPage() {
  const { data: carousel, isLoading } = useCarousel();
  const addMutation = useAddCarouselImage();
  const updateMutation = useUpdateCarouselItem();
  const deleteMutation = useDeleteCarouselImage();
  const reorderMutation = useReorderCarousel();
  
  const [altText, setAltText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploadKey, setUploadKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAlt, setEditingAlt] = useState('');

  const handleUpload = async () => {
    if (files.length === 0) return;
    // Upload one request per image (sequentially) so order is preserved and each stays under body-size limits.
    const remaining = [...files];
    for (const file of files) {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('altText', altText || 'Carousel Image');
      formData.append('isActive', 'true');
      try {
        await addMutation.mutateAsync(formData);
        remaining.shift();
      } catch {
        break;
      }
    }
    if (remaining.length === 0) {
      setFiles([]);
      setAltText('');
      setUploadKey(prev => prev + 1);
    } else {
      toast.error(`${remaining.length} image(s) failed to upload. Remove uploaded ones and retry.`);
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (!carousel) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= carousel.length) return;

    const newOrder = [...carousel];
    const [movedItem] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, movedItem);

    reorderMutation.mutate(newOrder.map(item => item._id));
  };

  const handleToggleVisibility = (item: CarouselImage) => {
    updateMutation.mutate({
      id: item._id,
      isActive: !item.isActive,
    });
  };

  const startEditAlt = (item: CarouselImage) => {
    setEditingId(item._id);
    setEditingAlt(item.alt || item.altText || '');
  };

  const saveEditAlt = (id: string) => {
    updateMutation.mutate({
      id,
      alt: editingAlt,
    }, {
      onSuccess: () => setEditingId(null)
    });
  };

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">Carousel Management</h1>

      <div className="mb-10 max-w-xl">
        <h3 className="font-montserrat text-xs uppercase tracking-wider text-forest mb-3 font-semibold">Upload New Image</h3>
        <ImageUploadZone 
          key={uploadKey}
          hint="Recommended: 1800 × 1200 px (3:2). Keep the subject in the centre; the edges may be trimmed on wide screens."
          multiple
          maxFiles={20}
          onFilesSelected={setFiles}
        />
        <div className="mt-4 flex flex-col gap-4">
          <input 
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Alt text for screen readers (optional but recommended)"
            className="w-full px-4 py-2.5 bg-cornsilk border border-olive/25 rounded-sm font-montserrat text-sm text-forest outline-none focus:border-olive transition-colors placeholder:text-forest/60/50"
          />
          <Button 
            onClick={handleUpload} 
            disabled={files.length === 0 || addMutation.isPending}
            className="self-end bg-forest text-cornsilk hover:bg-olive transition-colors cursor-pointer"
          >
            {addMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {addMutation.isPending ? 'Uploading...' : files.length > 1 ? `Save ${files.length} Images` : 'Save Image'}
          </Button>
        </div>
      </div>

      <h3 className="font-montserrat text-xs uppercase tracking-wider text-forest mb-4 font-semibold">Current Images</h3>
      
      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-olive" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {carousel?.map((item, idx) => (
            <div key={item._id} className={`flex flex-col rounded-md overflow-hidden border transition-colors group ${item.isActive ? 'border-olive/40 bg-warm/20' : 'border-olive/15 opacity-70 bg-warm/10'}`}>
              <div className="aspect-video relative overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.alt || item.altText || 'Carousel Image'} className="w-full h-full object-cover" />
                
                <div className="absolute top-2 left-2 bg-forest/80 text-cornsilk font-montserrat text-[10px] px-2 py-0.5 rounded-sm z-10">
                  {String(idx + 1).padStart(2, '0')}
                </div>

                <div className="absolute inset-0 bg-forest/80 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleMove(idx, 'up')}
                    disabled={idx === 0 || reorderMutation.isPending}
                    className="p-1.5 text-cornsilk hover:bg-white/20 rounded-sm disabled:opacity-30 cursor-pointer" 
                    title="Move Up"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button 
                    onClick={() => handleMove(idx, 'down')}
                    disabled={idx === (carousel.length - 1) || reorderMutation.isPending}
                    className="p-1.5 text-cornsilk hover:bg-white/20 rounded-sm disabled:opacity-30 cursor-pointer" 
                    title="Move Down"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button 
                    onClick={() => handleToggleVisibility(item)}
                    disabled={updateMutation.isPending}
                    className="p-1.5 text-cornsilk hover:bg-white/20 rounded-sm cursor-pointer" 
                    title={item.isActive ? "Hide Image" : "Show Image"}
                  >
                    {item.isActive ? <Eye className="size-4 text-green-300" /> : <EyeOff className="size-4 text-amber-300" />}
                  </button>
                  <button 
                    onClick={() => startEditAlt(item)}
                    className="p-1.5 text-cornsilk hover:bg-white/20 rounded-sm cursor-pointer" 
                    title="Edit Alt Text"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button 
                    onClick={() => deleteMutation.mutate(item._id)}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 text-copper hover:bg-copper/20 hover:text-red-400 rounded-sm cursor-pointer" 
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {item.isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-olive/80"></div>
                )}
              </div>

              {/* Alt text display / inline edit */}
              <div className="p-2 text-xs font-montserrat bg-cornsilk/50 border-t border-olive/10">
                {editingId === item._id ? (
                  <div className="flex items-center gap-1">
                    <input 
                      value={editingAlt}
                      onChange={(e) => setEditingAlt(e.target.value)}
                      className="flex-1 px-1.5 py-0.5 text-xs bg-white border border-olive/30 rounded text-forest outline-none"
                      autoFocus
                    />
                    <button 
                      onClick={() => saveEditAlt(item._id)}
                      className="p-1 text-green-700 hover:bg-green-100 rounded"
                      title="Save"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button 
                      onClick={() => setEditingId(null)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                      title="Cancel"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-forest/80">
                    <span className="truncate" title={item.alt || item.altText}>
                      {item.alt || item.altText || <span className="italic text-forest/40">No description</span>}
                    </span>
                    <button 
                      onClick={() => startEditAlt(item)}
                      className="ml-1 text-forest/40 hover:text-forest"
                      title="Edit"
                    >
                      <Pencil className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminProtectedRoute>
  );
}
