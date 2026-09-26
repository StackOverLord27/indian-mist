import { adminAxios } from '../admin-axios';
import { AdminCollection } from '@/types/admin';

export const fetchAdminCollections = async (filters?: { page?: number; limit?: number }) => {
  const { data } = await adminAxios.get<{ collections: AdminCollection[], total: number }>('/api/admin/collections', { params: filters });
  return data;
};

export const fetchAdminCollection = async (id: string) => {
  const { data } = await adminAxios.get<{ collection: AdminCollection }>(`/api/admin/collections/${id}`);
  return data.collection;
};

export const createCollection = async (payload: Partial<AdminCollection>) => {
  const { data } = await adminAxios.post<{ collection: AdminCollection }>('/api/admin/collections', payload);
  return data.collection;
};

export const updateCollection = async ({ id, payload }: { id: string; payload: Partial<AdminCollection> }) => {
  const { data } = await adminAxios.put<{ collection: AdminCollection }>(`/api/admin/collections/${id}`, payload);
  return data.collection;
};

export const deleteCollection = async (id: string) => {
  const { data } = await adminAxios.delete(`/api/admin/collections/${id}`);
  return data;
};
