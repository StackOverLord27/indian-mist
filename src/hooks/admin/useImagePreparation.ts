import { useState } from 'react';
import toast from 'react-hot-toast';
import { prepareImage, ImagePrepareError } from '@/lib/image-prepare';
import type { ProfileName } from '@/lib/image-budget';

/**
 * For single-file inputs (blog cover, size chart): shrinks the picked photo to its size budget
 * and shows the reason as a toast when that is not possible. `prepare` returns null on failure.
 */
export function useImagePreparation(profile: ProfileName = 'standard') {
  const [optimising, setOptimising] = useState(false);

  const prepare = async (file: File): Promise<File | null> => {
    setOptimising(true);
    try {
      return (await prepareImage(file, { profile })).file;
    } catch (error) {
      toast.error(error instanceof ImagePrepareError ? error.message : 'Could not optimise this image. Try another file.');
      return null;
    } finally {
      setOptimising(false);
    }
  };

  return { prepare, optimising };
}
