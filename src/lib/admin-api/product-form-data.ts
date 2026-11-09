/**
 * Builds the multipart request the product form sends to POST/PUT /api/admin/products.
 * One function used by the form AND by the tests, so the field names the route reads can never
 * drift from the ones the form sends.
 *
 * Field names (one per concept):
 *   images           each new image file
 *   removedImageIds  JSON list of publicIds of existing images to delete
 *   imageOrder       JSON list of publicIds of existing images, first = primary
 *   primaryImageId   publicId of the primary image (the first of imageOrder)
 *   coverImageId     publicId of the image shown on the category grid
 */
export type ProductFormValues = {
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  description: string;
  badge?: string;
  isFeatured: boolean;
  trackInventory: boolean;
  stockQuantity: number;
  sizes?: string[];
  sizeStock?: Record<string, number>;
  features: string[];
  colorName?: string;
  colorHex?: string;
  colorGroup?: string;
  tags: string;
  idealForHeading?: string;
  /** comma separated, like tags */
  idealFor?: string;
  materials: string[];
  careInstructions: { text: string; icon: string }[];
  shippingStandard?: string;
  shippingExpress?: string;
};

export type ProductImageChanges = {
  newFiles: File[];
  removedImageIds: string[];
  imageOrder: string[];
  coverImageId: string;
};

export function buildProductFormData(data: ProductFormValues, images: ProductImageChanges): FormData {
  const formData = new FormData();

  formData.append('name', data.name);
  formData.append('category', data.category);
  formData.append('price', data.price.toString());
  // Always sent, so clearing the box (or choosing "no badge") really clears it on the server
  formData.append('originalPrice', data.originalPrice ? data.originalPrice.toString() : '');
  formData.append('description', data.description);
  formData.append('badge', data.badge ?? '');
  formData.append('isFeatured', data.isFeatured ? 'true' : 'false');
  formData.append('trackInventory', data.trackInventory ? 'true' : 'false');
  formData.append('stockQuantity', String(data.stockQuantity || 0));
  // Per-size counts, only for the sizes currently selected
  formData.append('sizeStock', JSON.stringify(
    Object.fromEntries((data.sizes ?? []).map((size) => [size, Math.max(0, Math.floor(Number(data.sizeStock?.[size]) || 0))])),
  ));

  formData.append('features', JSON.stringify(data.features.filter((s) => s.trim())));
  if (data.sizes) formData.append('sizes', JSON.stringify(data.sizes));
  const colorName = (data.colorName ?? '').trim();
  formData.append('colorName', colorName);
  formData.append('colorHex', colorName ? (data.colorHex ?? '') : '');
  formData.append('colorGroup', data.colorGroup ?? '');
  formData.append('tags', JSON.stringify(data.tags.split(',').map((t) => t.trim()).filter(Boolean)));
  formData.append('idealForHeading', (data.idealForHeading ?? '').trim());
  formData.append('idealFor', JSON.stringify((data.idealFor ?? '').split(',').map((t) => t.trim()).filter(Boolean)));
  formData.append('materials', JSON.stringify(data.materials.filter((s) => s.trim())));
  formData.append('careInstructions', JSON.stringify(data.careInstructions.filter((c) => c.text.trim())));
  formData.append('shippingInfo', JSON.stringify({
    standard: data.shippingStandard || '',
    express: data.shippingExpress || '',
  }));

  images.newFiles.forEach((file) => formData.append('images', file));
  if (images.removedImageIds.length > 0) {
    formData.append('removedImageIds', JSON.stringify(images.removedImageIds));
  }
  // First image in imageOrder is primary
  if (images.imageOrder.length > 0) {
    formData.append('primaryImageId', images.imageOrder[0]);
    formData.append('imageOrder', JSON.stringify(images.imageOrder));
  }
  if (images.coverImageId) formData.append('coverImageId', images.coverImageId);

  return formData;
}
