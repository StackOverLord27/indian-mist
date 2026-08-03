import { adminAxios } from '../admin-axios';
import { CarouselImage } from '@/types/admin';

export const fetchCarouselImages = async () => {
  const { data } = await adminAxios.get<{ images: CarouselImage[] }>('/api/admin/carousel');
  return data.images;
};

export const addCarouselImage = async (formData: FormData) => {
  const { data } = await adminAxios.post<{ image: CarouselImage }>('/api/admin/carousel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data.image;
};

export const updateCarouselItem = async ({ id, ...updateData }: Partial<CarouselImage> & { id: string }) => {
  const { data } = await adminAxios.put<{ image: CarouselImage }>(`/api/admin/carousel/${id}`, updateData);
  return data.image;
};

export const deleteCarouselImage = async (id: string) => {
  const { data } = await adminAxios.delete(`/api/admin/carousel/${id}`);
  return data;
};

export const reorderCarousel = async (orderedIds: string[]) => {
  const { data } = await adminAxios.put('/api/admin/carousel/reorder', { orderedIds });
  return data;
};
