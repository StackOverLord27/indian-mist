'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, Star, ImageIcon, Trash2, X } from 'lucide-react';
import { ProductImage } from '@/types/admin';

interface ImageUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  currentImages?: ProductImage[];
  onRemoveExisting?: (publicId: string) => void;
  onSetPrimary?: (publicId: string) => void;
  onSetCategoryCover?: (publicId: string) => void;
  showCategoryCoverOption?: boolean;
}

export default function ImageUploadZone({
  onFilesSelected,
  multiple = false,
  maxFiles = 1,
  currentImages = [],
  onRemoveExisting,
  onSetPrimary,
  onSetCategoryCover,
  showCategoryCoverOption = false,
}: ImageUploadZoneProps) {
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const totalImages = currentImages.length + newFiles.length + filesArray.length;
      
      if (totalImages > maxFiles) {
        alert(`You can only upload a maximum of ${maxFiles} images.`);
        return;
      }

      const updatedFiles = multiple ? [...newFiles, ...filesArray] : filesArray;
      setNewFiles(updatedFiles);
      onFilesSelected(updatedFiles);

      // Create previews
      const urls = filesArray.map(file => URL.createObjectURL(file));
      setPreviewUrls(multiple ? [...previewUrls, ...urls] : urls);
    }
  };

  const handleRemoveNew = (index: number) => {
    const updatedFiles = [...newFiles];
    updatedFiles.splice(index, 1);
    setNewFiles(updatedFiles);
    onFilesSelected(updatedFiles);

    const updatedUrls = [...previewUrls];
    URL.revokeObjectURL(updatedUrls[index]);
    updatedUrls.splice(index, 1);
    setPreviewUrls(updatedUrls);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Create a synthetic event
      const event = {
        target: { files: e.dataTransfer.files }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(event);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div>
      <div 
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="dashed border-2 border-olive/25 rounded-md bg-warm/50 hover:bg-warm transition-colors cursor-pointer text-center p-8"
      >
        <UploadCloud className="text-olive/50 size-8 mx-auto mb-2" />
        <p className="font-montserrat text-sm text-forest/60">
          Drop images here or click to browse
        </p>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          multiple={multiple} 
          accept="image/jpeg, image/png, image/webp"
          onChange={handleFileChange}
        />
      </div>

      {(currentImages.length > 0 || previewUrls.length > 0) && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-4">
          {currentImages.map((img) => (
            <div 
              key={img.publicId} 
              className={`relative aspect-square rounded-sm overflow-hidden border-2 transition-colors group ${
                img.isPrimary ? 'border-olive' : 'border-olive/15'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="Product" className="object-cover w-full h-full" />
              
              {img.isPrimary && (
                <div className="absolute top-1 left-1 bg-forest text-cornsilk text-[8px] font-montserrat uppercase tracking-wider px-1.5 rounded-sm z-10">
                  Primary
                </div>
              )}
              {img.isCategoryCover && (
                <div className="absolute top-1 right-1 bg-clay text-cornsilk text-[8px] font-montserrat uppercase tracking-wider px-1.5 rounded-sm z-10">
                  Cover
                </div>
              )}

              <div className="absolute inset-0 bg-forest/60 flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex">
                {!img.isPrimary && onSetPrimary && (
                  <button 
                    type="button" 
                    onClick={() => onSetPrimary(img.publicId)}
                    className="text-cornsilk text-[9px] font-montserrat flex items-center gap-1 hover:text-white"
                  >
                    <Star className="size-3" /> Set Primary
                  </button>
                )}
                {showCategoryCoverOption && !img.isCategoryCover && onSetCategoryCover && (
                  <button 
                    type="button" 
                    onClick={() => onSetCategoryCover(img.publicId)}
                    className="text-cornsilk text-[9px] font-montserrat flex items-center gap-1 hover:text-white"
                  >
                    <ImageIcon className="size-3" /> Cover Image
                  </button>
                )}
                {onRemoveExisting && (
                  <button 
                    type="button" 
                    onClick={() => onRemoveExisting(img.publicId)}
                    className="text-copper text-[9px] font-montserrat flex items-center gap-1 hover:text-red-400 mt-1"
                  >
                    <Trash2 className="size-3" /> Remove
                  </button>
                )}
              </div>
            </div>
          ))}

          {previewUrls.map((url, index) => (
            <div 
              key={`preview-${index}`} 
              className="relative aspect-square rounded-sm overflow-hidden border-2 border-olive/15"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`New upload ${index + 1}`} className="object-cover w-full h-full" />
              <button 
                type="button"
                onClick={() => handleRemoveNew(index)}
                className="absolute top-1 right-1 bg-forest/80 text-cornsilk rounded-full p-1 hover:bg-copper transition-colors z-10"
              >
                <X className="size-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-forest/80 text-cornsilk text-[9px] font-montserrat truncate px-1 py-0.5 text-center">
                {newFiles[index]?.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
