import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import * as api from '@/lib/admin-api/products';
// import { AdminProduct } from '@/types/admin';

export const useAdminProducts = (filters?: { category?: string; page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['admin-products', filters],
    queryFn: () => api.fetchAdminProducts(filters),
  });
};

export const useAdminProduct = (id: string) => {
  return useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => api.fetchAdminProduct(id),
    enabled: !!id,
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: api.createProduct,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success('Product created successfully');
      router.push('/admin/products');
    },
  });
};

export const useUpdateProduct = (id: string) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (formData: FormData) => api.updateProduct({ id, formData }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
      toast.success('Product updated');
      router.push('/admin/products');
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteProduct,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success('Product deleted');
    },
  });
};

export const useReorderProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.reorderProducts,
    onMutate: async (orderedIds: string[]) => {
      // Optimistic update — reorder the local cache immediately
      await queryClient.cancelQueries({ queryKey: ['admin-products'] });
      
      // We don't have a reliable single previous state because there could be multiple queries matching the key,
      // so we rely on invalidation for rollback, which is safer here.
      queryClient.setQueriesData({ queryKey: ['admin-products'] }, (old: any) => {
        if (!old?.products) return old;
        const ordered = orderedIds
          .map(id => old.products.find((p: any) => p._id === id))
          .filter(Boolean);
        return { ...old, products: ordered };
      });
      return {};
    },
    onError: () => {
      // Revert via refetch on error
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.error('Failed to reorder');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
};
