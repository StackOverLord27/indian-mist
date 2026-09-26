import { adminAxios } from '../admin-axios';
import { AdminBlog } from '@/types/admin';

export const fetchAdminBlogs = async (filters?: { category?: string; status?: string; page?: number; limit?: number }) => {
  const { data } = await adminAxios.get<{ blogs: AdminBlog[]; total: number; page: number; totalPages: number }>('/api/admin/blogs', { params: filters });
  return data;
};

export const fetchAdminBlog = async (id: string) => {
  const { data } = await adminAxios.get<{ blog: AdminBlog }>(`/api/admin/blogs/${id}`);
  return data.blog;
};

export const createBlog = async (formData: FormData) => {
  const { data } = await adminAxios.post<{ blog: AdminBlog }>('/api/admin/blogs', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data.blog;
};

export const updateBlog = async ({ id, formData }: { id: string; formData: FormData }) => {
  const { data } = await adminAxios.put<{ blog: AdminBlog }>(`/api/admin/blogs/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data.blog;
};

export const deleteBlog = async (id: string) => {
  const { data } = await adminAxios.delete(`/api/admin/blogs/${id}`);
  return data;
};
