import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import * as api from '@/lib/admin-api/blogs';

export const useAdminBlogs = (filters?: { category?: string; status?: string; page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['admin-blogs', filters],
    queryFn: () => api.fetchAdminBlogs(filters),
  });
};

export const useAdminBlog = (id: string) => {
  return useQuery({
    queryKey: ['admin-blog', id],
    queryFn: () => api.fetchAdminBlog(id),
    enabled: !!id,
  });
};

export const useCreateBlog = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: api.createBlog,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-blogs'] });
      toast.success('Blog post created successfully');
      router.push('/admin/blogs');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create blog post');
    },
  });
};

export const useUpdateBlog = (id: string) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (formData: FormData) => api.updateBlog({ id, formData }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-blogs'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-blog', id] });
      toast.success('Blog post updated');
      router.push('/admin/blogs');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update blog post');
    },
  });
};

export const useDeleteBlog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteBlog,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-blogs'] });
      toast.success('Blog post deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete blog post');
    },
  });
};

export const useBlogCategories = () => {
  return useQuery({
    queryKey: ['admin-blog-categories'],
    queryFn: api.fetchBlogCategories,
  });
};

export const useCreateBlogCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.createBlogCategory(name),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin-blog-categories'], data.categories);
      void queryClient.invalidateQueries({ queryKey: ['admin-blog-categories'] });
      toast.success(`Category "${data.category}" created`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create category');
    },
  });
};
