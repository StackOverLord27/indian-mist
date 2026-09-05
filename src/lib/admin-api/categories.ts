import { adminAxios } from '../admin-axios';
import { AdminCategory } from '@/types/admin';

export const fetchAdminCategories = async (filters?: { page?: number; limit?: number }) => {
  const { data } = await adminAxios.get<{ categories: AdminCategory[], total: number }>('/api/admin/categories', { params: filters });
  return data;
};

export const fetchAdminCategory = async (id: string) => {
  const { data } = await adminAxios.get<{ category: AdminCategory }>(`/api/admin/categories/${id}`);
  return data.category;
};

export const createCategory = async (formData: FormData) => {
  const { data } = await adminAxios.post<{ category: AdminCategory }>('/api/admin/categories', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data.category;
};

export const updateCategory = async ({ id, formData }: { id: string; formData: FormData }) => {
  const { data } = await adminAxios.put<{ category: AdminCategory }>(`/api/admin/categories/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data.category;
};

export const deleteCategory = async (id: string) => {
  const { data } = await adminAxios.delete(`/api/admin/categories/${id}`);
  return data;
};
