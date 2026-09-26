import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import * as api from '@/lib/admin-api/collections';
import { AdminCollection } from '@/types/admin';

export const useAdminCollections = (filters?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['admin-collections', filters],
    queryFn: () => api.fetchAdminCollections(filters),
  });
};

export const useAdminCollection = (id: string) => {
  return useQuery({
    queryKey: ['admin-collection', id],
    queryFn: () => api.fetchAdminCollection(id),
    enabled: !!id,
  });
};

export const useCreateCollection = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: api.createCollection,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
      toast.success('Collection created successfully');
      router.push('/admin/collections');
    },
  });
};

export const useUpdateCollection = (id: string) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: Partial<AdminCollection>) => api.updateCollection({ id, payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-collection', id] });
      toast.success('Collection updated');
      router.push('/admin/collections');
    },
  });
};

export const useDeleteCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteCollection,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
      toast.success('Collection deleted');
    },
  });
};
