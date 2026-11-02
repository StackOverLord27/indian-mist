import { adminAxios } from '../admin-axios';
import { AdminProduct, AdminProductSummary, PaginationMeta } from '@/types/admin';

export type AdminProductFilters = { category?: string; search?: string; page?: number; limit?: number };

export const fetchAdminProducts = async (filters?: AdminProductFilters) => {
  const { data } = await adminAxios.get<{ products: AdminProductSummary[] } & PaginationMeta>('/api/admin/products', { params: filters });
  return data;
};

export const fetchColorGroups = async () => {
  const { data } = await adminAxios.get<{ colorGroups: string[] }>('/api/admin/products/color-groups');
  return data.colorGroups;
};

export const fetchAdminProduct = async (id: string) => {
  const { data } = await adminAxios.get<{ product: AdminProduct }>(`/api/admin/products/${id}`);
  return data.product;
};

export const createProduct = async (formData: FormData) => {
  const { data } = await adminAxios.post<{ product: AdminProduct }>('/api/admin/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data.product;
};

export const updateProduct = async ({ id, formData }: { id: string; formData: FormData }) => {
  const { data } = await adminAxios.put<{ product: AdminProduct }>(`/api/admin/products/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data.product;
};

export const deleteProduct = async (id: string) => {
  const { data } = await adminAxios.delete(`/api/admin/products/${id}`);
  return data;
};

/** `orderedIds` are one page of products in their new order; `offset` is where that page starts in the full list */
export const reorderProducts = async ({ orderedIds, offset }: { orderedIds: string[]; offset: number }) => {
  const { data } = await adminAxios.put('/api/admin/products/reorder', { orderedIds, offset });
  return data;
};
