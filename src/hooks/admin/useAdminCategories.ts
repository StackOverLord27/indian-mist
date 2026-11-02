import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import * as api from '@/lib/admin-api/categories';
import { getApiErrorMessage } from '@/lib/admin-error';

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

type CategoriesPage = { categories: { _id: string }[]; page: number; limit: number };
type ReorderVars = { orderedIds: string[]; offset?: number };

export const useReorderCategories = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.reorderCategories,
    onMutate: async ({ orderedIds, offset = 0 }: ReorderVars) => {
      await queryClient.cancelQueries({ queryKey: ['admin-categories'] });

      // Only the cached page that matches this reorder (same position, same categories)
      const wanted = new Set(orderedIds);
      const previous: [readonly unknown[], CategoriesPage][] = [];
      for (const [key, data] of queryClient.getQueriesData<CategoriesPage>({ queryKey: ['admin-categories'] })) {
        if (!data?.categories || (data.page - 1) * data.limit !== offset) continue;
        if (data.categories.length !== wanted.size || data.categories.some((c) => !wanted.has(c._id))) continue;
        previous.push([key, data]);
        const byId = new Map(data.categories.map((c) => [c._id, c]));
        queryClient.setQueryData<CategoriesPage>(key, { ...data, categories: orderedIds.map((id) => byId.get(id)!) });
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      toast.error(getApiErrorMessage(error, 'Failed to reorder'));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    },
  });
};
