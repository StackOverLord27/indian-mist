import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as api from '@/lib/admin-api/settings';

export const useSiteSettings = () => {
  return useQuery({
    queryKey: ['admin-settings'],
    queryFn: api.fetchSiteSettings,
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.updateSiteSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      toast.success('Settings updated');
    },
  });
};
