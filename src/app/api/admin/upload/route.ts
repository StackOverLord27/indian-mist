export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAdmin, parseFormData, validateImageFile, errorResponse, successResponse } from '@/lib/api-helpers';
import { uploadImage } from '@/lib/cloudinary';

export const POST = withAdmin(async (req: NextRequest) => {
  const { files, fields } = await parseFormData(req);
  
  if (!files.length) {
    return errorResponse('No image file provided', 400);
  }

  const file = files[0];
  const validation = validateImageFile(file);
  
  if (!validation.valid) {
    return errorResponse(validation.message!, 400);
  }

  // Determine the folder based on the context, defaulting to 'settings'
  const folderContext = fields.context || 'settings';
  const folder = `indian-mist/${folderContext}`;

  try {
    const result = await uploadImage(file.buffer, { folder });
    return successResponse({ 
      url: result.url, 
      publicId: result.publicId 
    }, 201);
  } catch (error) {
    console.error('Upload Error:', error);
    return errorResponse('Failed to upload image', 500);
  }
});
