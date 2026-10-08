 
import dbConnect from './db';
import type { NextRequest } from 'next/server';
import mongoose from 'mongoose';

export type RouteContext = {
  params: Promise<Record<string, string>>;
};

type AdminContext = RouteContext & {
  userId: string;
  email: string;
};

export type UploadedFile = {
  fieldname: string;
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

type AdminHandler = (
  req: NextRequest,
  context: AdminContext
) => Promise<Response>;

export function successResponse<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(
  message: string,
  status: number,
  errors?: Record<string, string>
) {
  return Response.json(
    { message, ...(errors && { errors }) },
    { status }
  );
}

export function handleApiError(error: unknown): Response {
  console.error('[API Error]', error);

  if (error instanceof mongoose.Error.CastError) {
    return errorResponse('Invalid ID format', 400);
  }
  if (error instanceof mongoose.Error.ValidationError) {
    const errors: Record<string, string> = {};
    Object.entries(error.errors).forEach(([key, val]) => {
      errors[key] = val.message;
    });
    return errorResponse('Validation failed', 400, errors);
  }
  const mongoError = error as { code?: number; keyValue?: Record<string, unknown> } | null;
  if (mongoError?.code === 11000) {
    const field = Object.keys(mongoError.keyValue ?? {})[0];
    return errorResponse(`${field ?? 'Field'} already exists`, 409);
  }
  return errorResponse('Internal server error', 500);
}

export function withAdmin(handler: AdminHandler) {
  return async (
    req: NextRequest,
    context: RouteContext
  ): Promise<Response> => {
    try {
      const role = req.headers.get('x-user-role');
      const userId = req.headers.get('x-user-id');
      const email = req.headers.get('x-user-email');

      if (!role || !userId) {
        return errorResponse('Unauthenticated', 401);
      }

      if (role !== 'admin') {
        return errorResponse('Forbidden: admin access only', 403);
      }

      await dbConnect();

      return await handler(req, {
        ...context,
        userId,
        email: email ?? '',
      });
    } catch (error) {
      return handleApiError(error);
    }
  };
}

export function withDB(
  handler: (req: NextRequest, context: RouteContext) => Promise<Response>
) {
  return async (
    req: NextRequest, 
    context: RouteContext
  ): Promise<Response> => {
    try {
      await dbConnect();
      return await handler(req, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

export async function parseFormData(req: NextRequest): Promise<{
  fields: Record<string, string>;
  files: UploadedFile[];
}> {
  const formData = await req.formData();
  const fields: Record<string, string> = {};
  const files: UploadedFile[] = [];

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const arrayBuffer = await value.arrayBuffer();
      files.push({
        fieldname: key,
        buffer: Buffer.from(arrayBuffer),
        mimetype: value.type,
        originalname: value.name,
        size: value.size,
      });
    } else {
      fields[key] = value as string;
    }
  }
  return { fields, files };
}

// The first bytes of a real JPEG, PNG or WebP file. The browser-reported type can be faked.
function looksLikeImage(buffer: Buffer): boolean {
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp =
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isWebp;
}

export function validateImageFile(file: {
  mimetype: string;
  size: number;
  buffer?: Buffer;
}): { valid: boolean; message?: string } {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    return { valid: false, message: 'Only JPEG, PNG and WebP are allowed' };
  }
  if (file.buffer && !looksLikeImage(file.buffer)) {
    return { valid: false, message: 'This file is not a valid image' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, message: 'File must be under 10MB' };
  }
  return { valid: true };
}
