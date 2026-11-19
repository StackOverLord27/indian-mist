import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import * as api from '@/lib/admin-api/products';
import { getApiErrorMessage } from '@/lib/admin-error';
import type { AdminProductSummary } from '@/types/admin';

// The previous page stays on screen while the next one loads, so the list does not flash empty
export const useAdminProducts = (filters?: api.AdminProductFilters) => {
  return useQuery({
    queryKey: ['admin-products', filters],
    queryFn: () => api.fetchAdminProducts(filters),
    placeholderData: keepPreviousData,
  });
};

/** Distinct colour groups already in use (suggestions in the product form) */
export const useColorGroups = () => {
  return useQuery({
    queryKey: ['admin-color-groups'],
    queryFn: api.fetchColorGroups,
    staleTime: 60_000,
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
      void queryClient.invalidateQueries({ queryKey: ['admin-color-groups'] });
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
      void queryClient.invalidateQueries({ queryKey: ['admin-color-groups'] });
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
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete product'));
    },
  });
};

type ProductsPage = { products: AdminProductSummary[]; page: number; limit: number };
type ReorderVars = { orderedIds: string[]; offset: number };

export const useReorderProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.reorderProducts,
    onMutate: async ({ orderedIds, offset }: ReorderVars) => {
      await queryClient.cancelQueries({ queryKey: ['admin-products'] });

      // Only the cached page that is exactly this page (same position, same products) is
      // reordered. Other cached pages, searches and filters are left alone.
      const wanted = new Set(orderedIds);
      const previous: [readonly unknown[], ProductsPage][] = [];
      for (const [key, data] of queryClient.getQueriesData<ProductsPage>({ queryKey: ['admin-products'] })) {
        if (!data?.products || (data.page - 1) * data.limit !== offset) continue;
        if (data.products.length !== wanted.size || data.products.some((p) => !wanted.has(p._id))) continue;
        previous.push([key, data]);
        const byId = new Map(data.products.map((p) => [p._id, p]));
        queryClient.setQueryData<ProductsPage>(key, {
          ...data,
          products: orderedIds.map((id) => byId.get(id)!),
        });
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      // Put the pages back, then fetch the truth (after a 409 the list really has changed)
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.error(getApiErrorMessage(error, 'Failed to reorder'));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
};
