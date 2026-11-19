import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/admin-error';
import { fetchFailedEmails, resendFailedEmail } from '@/lib/admin-api/emails';

export const useFailedEmails = () =>
  useQuery({ queryKey: ['admin-failed-emails'], queryFn: fetchFailedEmails, refetchOnWindowFocus: true });

export const useResendEmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resendFailedEmail,
    onSuccess: () => {
      toast.success('Sent again');
      void queryClient.invalidateQueries({ queryKey: ['admin-failed-emails'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not send it again')),
  });
};
