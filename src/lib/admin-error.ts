import { isAxiosError } from 'axios';

/** Turns any thrown value (axios error, Error, or anything else) into a readable message. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { errors?: unknown; message?: unknown; error?: unknown }
      | undefined;
    if (Array.isArray(data?.errors)) return data.errors.join(', ');
    if (typeof data?.message === 'string' && data.message) return data.message;
    if (typeof data?.error === 'string' && data.error) return data.error;
  }

  if (error instanceof Error && error.message) return error.message;

  return fallback;
}
