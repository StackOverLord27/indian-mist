import { adminAxios } from '../admin-axios';
import { AboutContent } from '@/types/admin';

export const fetchAboutContent = async () => {
  const { data } = await adminAxios.get<{ about: AboutContent }>('/api/admin/about');
  return data.about;
};

export const updateAboutContent = async (about: AboutContent) => {
  const { data } = await adminAxios.put<{ about: AboutContent }>('/api/admin/about', about);
  return data.about;
};
