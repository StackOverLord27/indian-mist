import { adminAxios } from '../admin-axios';

export type LegalPageData = { title: string; content: string };

export const fetchLegalPage = async (slug: string) => {
  const { data } = await adminAxios.get<{ page: LegalPageData | null }>(`/api/admin/legal/${slug}`);
  return data.page;
};

export const updateLegalPage = async (slug: string, page: LegalPageData) => {
  const { data } = await adminAxios.put<{ page: LegalPageData }>(`/api/admin/legal/${slug}`, page);
  return data.page;
};
