import { isAxiosError } from 'axios';

export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
      return error.response.data.errors.join(', ');
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'Something went wrong';
}
