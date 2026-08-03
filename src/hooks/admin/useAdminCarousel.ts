import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as api from '@/lib/admin-api/carousel';

export const useCarousel = () => {
  return useQuery({
    queryKey: ['admin-carousel'],
    queryFn: api.fetchCarouselImages,
  });
};

export const useAddCarouselImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.addCarouselImage,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-carousel'] });
      toast.success('Image added to carousel');
    },
  });
};

export const useUpdateCarouselItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.updateCarouselItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-carousel'] });
      toast.success('Carousel item updated');
    },
  });
};

export const useDeleteCarouselImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteCarouselImage,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-carousel'] });
      toast.success('Carousel image deleted');
    },
  });
};

export const useReorderCarousel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.reorderCarousel,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-carousel'] });
    },
  });
};
