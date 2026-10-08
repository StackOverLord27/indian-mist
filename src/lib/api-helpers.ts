 
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

export function validateImageFile(file: {
  mimetype: string;
  size: number;
}): { valid: boolean; message?: string } {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    return { valid: false, message: 'Only JPEG, PNG and WebP are allowed' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, message: 'File must be under 10MB' };
  }
  return { valid: true };
}
