'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UploadCloud, Star, ImageIcon, Trash2, X, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { ProductImage } from '@/types/admin';
import { prepareImage, ImagePrepareError } from '@/lib/image-prepare';
import { perFileBudget, tooManyForOneSaveMessage, howManyFit, PROFILES, formatBytes, type ProfileName } from '@/lib/image-budget';

interface ImageUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  currentImages?: ProductImage[];
  onRemoveExisting?: (publicId: string) => void;
  onSetPrimary?: (publicId: string) => void;
  onSetCategoryCover?: (publicId: string) => void;
  onReorderImages?: (orderedPublicIds: string[]) => void;
  showCategoryCoverOption?: boolean;
  hint?: string;
  /** Size rules: 'standard' for photos, 'sizeChart' for a chart full of small text */
  profile?: ProfileName;
  /** True when all the picked files are sent in ONE request (the product form): they then share the request's size budget */
  filesSentTogether?: boolean;
  /** Called with true while images are being optimised; forms use it to hold the Save button */
  onBusyChange?: (busy: boolean) => void;
}

/** A picked photo: the original, and what will actually be uploaded once it has been optimised. */
type PickedItem = {
  id: number;
  original: File;
  prepared: File | null;
  previewUrl: string | null;
};

export default function ImageUploadZone({
  onFilesSelected,
  multiple = false,
  maxFiles = 1,
  currentImages = [],
  onRemoveExisting,
  onSetPrimary,
  onSetCategoryCover,
  onReorderImages,
  showCategoryCoverOption = false,
  hint,
  profile = 'standard',
  filesSentTogether = false,
  onBusyChange,
}: ImageUploadZoneProps) {
  const [items, setItems] = useState<PickedItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  // Always the latest list, for the async optimising below
  const itemsRef = useRef<PickedItem[]>([]);
  const runRef = useRef(0);

  const commit = (next: PickedItem[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  useEffect(() => () => {
    runRef.current++; // a run that is still going stops touching state
    itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
  }, []);

  const setBusyState = (message: string | null) => {
    setBusy(message);
    onBusyChange?.(message !== null);
  };

  /**
   * Optimises every picked photo to its share of the budget, one at a time (with progress), then
   * tells the parent which files to upload. Photos already optimised that still fit are kept as they are.
   */
  const optimise = async (candidates: PickedItem[]) => {
    const run = ++runRef.current;
    setProblem(null);
    const prof = PROFILES[profile];
    const budget = filesSentTogether ? perFileBudget(prof, candidates.length) : prof.budgetBytes;
    const done: PickedItem[] = [];
    const failures: string[] = [];
    try {
      for (const [index, item] of candidates.entries()) {
        if (run !== runRef.current) return;
        if (item.prepared && item.prepared.size <= budget) { done.push(item); continue; }
        setBusyState(`Optimising image ${index + 1} of ${candidates.length}…`);
        try {
          const result = await prepareImage(item.original, { profile, budgetBytes: budget });
          if (run !== runRef.current) return;
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          done.push({ ...item, prepared: result.file, previewUrl: URL.createObjectURL(result.file) });
        } catch (error) {
          // This photo is dropped (with the reason); the others carry on
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          failures.push(error instanceof ImagePrepareError ? error.message : `"${item.original.name}" could not be optimised. Try another file.`);
        }
      }
      if (run !== runRef.current) return;
      commit(done);
      onFilesSelected(done.map((i) => i.prepared!));
      if (failures.length) {
        setProblem(
          filesSentTogether && candidates.length > 1
            ? tooManyForOneSaveMessage(candidates.length, Math.max(howManyFit(done.map((i) => i.prepared!.size)), 1))
            : failures.join(' '),
        );
      }
    } finally {
      if (run === runRef.current) setBusyState(null);
    }
  };

  const addFiles = (filesArray: File[]) => {
    const current = itemsRef.current;
    const totalImages = currentImages.length + current.length + filesArray.length;
    if (totalImages > maxFiles) {
      setProblem(`You can only upload a maximum of ${maxFiles} images.`);
      return;
    }
    const added: PickedItem[] = filesArray.map((original) => ({ id: nextId.current++, original, prepared: null, previewUrl: null }));
    if (!multiple) current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    void optimise(multiple ? [...current, ...added] : added);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addFiles(Array.from(e.target.files));
    // let the same file be picked again after it was removed
    if (e.target instanceof HTMLInputElement) e.target.value = '';
  };

  const handleRemoveNew = (index: number) => {
    const next = [...itemsRef.current];
    const [removed] = next.splice(index, 1);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    commit(next);
    onFilesSelected(next.filter((i) => i.prepared).map((i) => i.prepared!));
    setProblem(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const event = {
        target: { files: e.dataTransfer.files }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(event);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    if (!onReorderImages) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentImages.length) return;
    const newOrder = [...currentImages];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);
    onReorderImages(newOrder.map(img => img.publicId));
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
        <p className="font-montserrat text-[10px] text-forest/40 mt-1">
          Large photos are shrunk automatically before they are uploaded.
        </p>
        {hint && (
          <p className="font-montserrat text-xs text-forest/50 mt-2">{hint}</p>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          multiple={multiple} 
          accept="image/jpeg, image/png, image/webp"
          onChange={handleFileChange}
        />
      </div>

      {busy && (
        <p role="status" className="flex items-center gap-2 mt-3 font-montserrat text-xs text-forest/70">
          <Loader2 className="size-3.5 animate-spin" /> {busy}
        </p>
      )}
      {problem && (
        <p role="alert" className="mt-3 font-montserrat text-xs text-copper bg-copper/10 border border-copper/20 rounded-sm p-2">
          {problem}
        </p>
      )}

      {(currentImages.length > 0 || items.length > 0) && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-4">
          {currentImages.map((img, index) => (
            <div 
              key={img.publicId} 
              className={`relative aspect-square rounded-sm overflow-hidden border-2 transition-colors group ${
                index === 0 ? 'border-olive' : 'border-olive/15'
              }`}
            >
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt="Product" className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-olive/10" />
              )}
              
              {index === 0 && (
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
                {/* Reorder arrows */}
                {onReorderImages && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleMoveImage(index, 'up'); }}
                      disabled={index === 0}
                      className="p-1 text-cornsilk hover:bg-white/20 rounded-sm disabled:opacity-30"
                      title="Move left"
                    >
                      <ArrowUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleMoveImage(index, 'down'); }}
                      disabled={index === currentImages.length - 1}
                      className="p-1 text-cornsilk hover:bg-white/20 rounded-sm disabled:opacity-30"
                      title="Move right"
                    >
                      <ArrowDown className="size-3" />
                    </button>
                  </div>
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

 
          {items.map((item, index) => (
            <div 
              key={`preview-${item.id}`} 
              className="relative aspect-square rounded-sm overflow-hidden border-2 border-olive/15"
            >
              {item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt={`New upload ${index + 1}`} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-olive/10 flex items-center justify-center"><Loader2 className="size-4 animate-spin text-olive/60" /></div>
              )}
              <button 
                type="button"
                onClick={() => handleRemoveNew(index)}
                className="absolute top-1 right-1 bg-forest/80 text-cornsilk rounded-full p-1 hover:bg-copper transition-colors z-10"
              >
                <X className="size-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-forest/80 text-cornsilk text-[9px] font-montserrat truncate px-1 py-0.5 text-center">
                {item.prepared ? `${item.prepared.name} · ${formatBytes(item.prepared.size)}` : item.original.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
