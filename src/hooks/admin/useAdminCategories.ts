import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import * as api from '@/lib/admin-api/categories';

export const useAdminCategories = (filters?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['admin-categories', filters],
    queryFn: () => api.fetchAdminCategories(filters),
  });
};

export const useAdminCategory = (id: string) => {
  return useQuery({
    queryKey: ['admin-category', id],
    queryFn: () => api.fetchAdminCategory(id),
    enabled: !!id,
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      toast.success('Category created successfully');
      router.push('/admin/categories');
    },
  });
};

export const useUpdateCategory = (id: string) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (formData: FormData) => api.updateCategory({ id, formData }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-category', id] });
      toast.success('Category updated');
      router.push('/admin/categories');
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      toast.success('Category deleted');
    },
  });
};

export const useReorderCategories = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.reorderCategories,
    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['admin-categories'] });
      
      queryClient.setQueriesData({ queryKey: ['admin-categories'] }, (old: { categories?: { _id: string }[] } | undefined) => {
        if (!old?.categories) return old;
        const categories = old.categories;
        const ordered = orderedIds
          .map(id => categories.find((c) => c._id === id))
          .filter(Boolean);
        return { ...old, categories: ordered };
      });
      return {};
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      toast.error('Failed to reorder');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    },
  });
};
