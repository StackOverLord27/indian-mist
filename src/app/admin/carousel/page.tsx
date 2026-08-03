'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import ImageUploadZone from '@/components/admin/ui/ImageUploadZone';
import { useCarousel, useAddCarouselImage, useDeleteCarouselImage, useReorderCarousel } from '@/hooks/admin/useAdminCarousel';
import { ArrowUp, ArrowDown, Pencil, Eye, EyeOff, Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function AdminCarouselPage() {
  const { data: carousel, isLoading } = useCarousel();
  const addMutation = useAddCarouselImage();
  const deleteMutation = useDeleteCarouselImage();
  
  const [altText, setAltText] = useState('');

  const handleUpload = (files: File[]) => {
    if (files.length > 0) {
      const formData = new FormData();
      formData.append('image', files[0]);
      formData.append('altText', altText || 'Carousel Image');
      formData.append('isActive', 'true');
      addMutation.mutate(formData);
      setAltText('');
    }
  };

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">Carousel Management</h1>

      <div className="mb-10 max-w-xl">
        <h3 className="font-montserrat text-xs uppercase tracking-wider text-forest mb-3 font-semibold">Upload New Image</h3>
        <ImageUploadZone 
          multiple={false} 
          onFilesSelected={handleUpload} 
        />
        <div className="mt-4">
          <input 
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Alt text for screen readers (optional but recommended)"
            className="w-full px-4 py-2.5 bg-cornsilk border border-olive/25 rounded-sm font-montserrat text-sm text-forest outline-none focus:border-olive transition-colors placeholder:text-forest/60/50"
          />
        </div>
      </div>

      <h3 className="font-montserrat text-xs uppercase tracking-wider text-forest mb-4 font-semibold">Current Images</h3>
      
      {isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-olive" /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {carousel?.map((item, idx) => (
            <div key={item._id} className={`aspect-video relative rounded-md overflow-hidden border transition-colors group ${item.isActive ? 'border-olive/40' : 'border-olive/15 opacity-60'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.altText} className="w-full h-full object-cover" />
              
              <div className="absolute top-2 left-2 bg-forest/80 text-cornsilk font-montserrat text-[10px] px-2 py-0.5 rounded-sm z-10">
                {String(idx + 1).padStart(2, '0')}
              </div>

              <div className="absolute inset-0 bg-forest/80 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 text-cornsilk hover:bg-white/20 rounded-sm" title="Move Up"><ArrowUp className="size-4" /></button>
                <button className="p-1.5 text-cornsilk hover:bg-white/20 rounded-sm" title="Move Down"><ArrowDown className="size-4" /></button>
                <button className="p-1.5 text-cornsilk hover:bg-white/20 rounded-sm" title="Toggle Visibility">
                  {item.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                <button 
                  onClick={() => deleteMutation.mutate(item._id)}
                  className="p-1.5 text-copper hover:bg-copper/20 hover:text-red-400 rounded-sm" 
                  title="Delete"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {item.isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-olive/80"></div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminProtectedRoute>
  );
}
