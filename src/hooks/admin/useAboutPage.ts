import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as api from '@/lib/admin-api/about';

export const useAboutContent = () => {
  return useQuery({
    queryKey: ['admin-about'],
    queryFn: api.fetchAboutContent,
  });
};

export const useUpdateAbout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.updateAboutContent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-about'] });
      toast.success('About page updated');
    },
  });
};
