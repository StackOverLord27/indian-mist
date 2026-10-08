 
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  message?: string;
  error?: string;
  errors?: Record<string, string>;
  data?: T;
}
