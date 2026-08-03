import { adminAxios } from '../admin-axios';
import { SiteSettings } from '@/types/admin';

export const fetchSiteSettings = async () => {
  const { data } = await adminAxios.get<{ settings: SiteSettings }>('/api/admin/settings');
  return data.settings;
};

export const updateSiteSettings = async (settings: SiteSettings) => {
  const { data } = await adminAxios.put<{ settings: SiteSettings }>('/api/admin/settings', settings);
  return data.settings;
};
