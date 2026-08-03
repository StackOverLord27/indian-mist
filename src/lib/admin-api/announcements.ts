import { adminAxios } from '../admin-axios';
import { Announcement } from '@/types/admin';

export const fetchAnnouncements = async () => {
  const { data } = await adminAxios.get<{ announcements: Announcement[] }>('/api/admin/announcements');
  return data.announcements;
};

export const createAnnouncement = async (announcement: Partial<Announcement>) => {
  const { data } = await adminAxios.post<{ announcement: Announcement }>('/api/admin/announcements', announcement);
  return data.announcement;
};

export const updateAnnouncement = async ({ id, ...updateData }: Partial<Announcement> & { id: string }) => {
  const { data } = await adminAxios.put<{ announcement: Announcement }>(`/api/admin/announcements/${id}`, updateData);
  return data.announcement;
};

export const deleteAnnouncement = async (id: string) => {
  const { data } = await adminAxios.delete(`/api/admin/announcements/${id}`);
  return data;
};

export const toggleAnnouncement = async ({ id, isActive }: { id: string; isActive: boolean }) => {
  const { data } = await adminAxios.patch<{ announcement: Announcement }>(`/api/admin/announcements/${id}`, { isActive });
  return data.announcement;
};

export const reorderAnnouncements = async (orderedIds: string[]) => {
  const { data } = await adminAxios.put('/api/admin/announcements/reorder', { orderedIds });
  return data;
};
