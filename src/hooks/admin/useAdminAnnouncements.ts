import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as api from '@/lib/admin-api/announcements';
// import { Announcement } from '@/types/admin';

export const useAnnouncements = () => {
  return useQuery({
    queryKey: ['admin-announcements'],
    queryFn: api.fetchAnnouncements,
  });
};

export const useCreateAnnouncement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createAnnouncement,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement created');
    },
  });
};

export const useUpdateAnnouncement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.updateAnnouncement,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement updated');
    },
  });
};

export const useDeleteAnnouncement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteAnnouncement,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement deleted');
    },
  });
};

export const useToggleAnnouncement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.toggleAnnouncement,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement status updated');
    },
  });
};

export const useReorderAnnouncements = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.reorderAnnouncements,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
    },
  });
};
