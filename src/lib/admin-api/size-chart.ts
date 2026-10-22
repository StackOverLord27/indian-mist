import { adminAxios } from '../admin-axios';

export type SizeChart = { url?: string; publicId?: string };

export const fetchSizeChart = async () => {
  const { data } = await adminAxios.get<{ sizeChart: SizeChart }>('/api/admin/size-chart');
  return data.sizeChart;
};

export const uploadSizeChart = async (file: File) => {
  const formData = new FormData();
  formData.append('image', file);
  const { data } = await adminAxios.put<{ sizeChart: SizeChart }>('/api/admin/size-chart', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.sizeChart;
};

export const deleteSizeChart = async () => {
  await adminAxios.delete('/api/admin/size-chart');
};
