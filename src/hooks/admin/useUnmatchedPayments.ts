import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/admin-error';
import { fetchUnmatchedPayments, resolveUnmatchedPayment, fetchRefundPendingCount } from '@/lib/admin-api/unmatched-payments';

export const useUnmatchedPayments = () =>
  useQuery({ queryKey: ['admin-unmatched-payments'], queryFn: fetchUnmatchedPayments, refetchOnWindowFocus: true });

export const useResolveUnmatchedPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resolveUnmatchedPayment,
    onSuccess: () => {
      toast.success('Marked as resolved');
      void queryClient.invalidateQueries({ queryKey: ['admin-unmatched-payments'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not mark it resolved')),
  });
};

export const useRefundPendingCount = () =>
  useQuery({ queryKey: ['admin-refund-pending-count'], queryFn: fetchRefundPendingCount, refetchOnWindowFocus: true });
