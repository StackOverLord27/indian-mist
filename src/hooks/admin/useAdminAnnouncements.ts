import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as api from '@/lib/admin-api/announcements';
import { getApiErrorMessage } from '@/lib/admin-error';

const KEY = ['admin-announcements'];

export const useAnnouncements = () => {
  return useQuery({
    queryKey: KEY,
    queryFn: api.fetchAnnouncements,
  });
};

function useAnnouncementMutation<V, R>(
  mutationFn: (variables: V) => Promise<R>,
  successMessage: string,
  failureMessage: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      toast.success(successMessage);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, failureMessage));
    },
  });
}

export const useCreateAnnouncement = () =>
  useAnnouncementMutation(api.createAnnouncement, 'Announcement created', 'Failed to create announcement');

export const useUpdateAnnouncement = () =>
  useAnnouncementMutation(api.updateAnnouncement, 'Announcement updated', 'Failed to update announcement');

export const useDeleteAnnouncement = () =>
  useAnnouncementMutation(api.deleteAnnouncement, 'Announcement deleted', 'Failed to delete announcement');

export const useToggleAnnouncement = () =>
  useAnnouncementMutation(api.toggleAnnouncement, 'Announcement status updated', 'Failed to update announcement');
