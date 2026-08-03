import { adminAxios } from '../admin-axios';
import { AdminProduct } from '@/types/admin';

export const fetchAdminProducts = async (filters?: { category?: string; page?: number; limit?: number }) => {
  const { data } = await adminAxios.get<{ products: AdminProduct[], total: number }>('/api/admin/products', { params: filters });
  return data;
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
