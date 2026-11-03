import { isAxiosError } from 'axios';

/** Turns any thrown value (axios error, Error, or anything else) into a readable message. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { errors?: unknown; message?: unknown; error?: unknown }
      | undefined;
    if (Array.isArray(data?.errors)) return data.errors.join(', ');
    if (typeof data?.message === 'string' && data.message) {
      // Routes send { message: 'Validation failed', errors: { field: 'what is wrong' } }: show the first reason too
      if (data.errors && typeof data.errors === 'object') {
        const first = Object.entries(data.errors as Record<string, unknown>).find(([, v]) => typeof v === 'string' && v);
        if (first) return `${data.message}: ${first[1]}`;
      }
      return data.message;
    }
    if (typeof data?.error === 'string' && data.error) return data.error;
    // The hosting platform's own "payload too large" answer is not JSON and has no message
    if (error.response?.status === 413) {
      return 'This upload is too large. Use fewer or smaller images and try again.';
    }
  }

  if (error instanceof Error && error.message) return error.message;

  return fallback;
}
