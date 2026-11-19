import { adminAxios } from '../admin-axios';

/** Uploads one image to Cloudinary when it is picked. It is not part of any page until the page is saved. */
export async function uploadAdminImage(file: File, context: 'about' | 'brand-story' | 'settings'): Promise<{ url: string; publicId: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('context', context);
  const { data } = await adminAxios.post('/api/admin/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return { url: data.url, publicId: data.publicId };
}

/**
 * Deletes a file that was uploaded but never saved. The server refuses files that are in use,
 * so this is safe to call for anything; failures are ignored (the file is just left behind).
 */
export async function discardUploadedImage(publicId: string): Promise<void> {
  if (!publicId) return;
  try {
    await adminAxios.delete('/api/admin/upload', { data: { publicId } });
  } catch {
    // Not fatal: at worst an unused file stays in Cloudinary
  }
}
