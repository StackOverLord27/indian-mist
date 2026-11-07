import { useQuery } from '@tanstack/react-query';
import { fetchUnmatchedPayments } from '@/lib/admin-api/unmatched-payments';

export const useUnmatchedPayments = () =>
  useQuery({ queryKey: ['admin-unmatched-payments'], queryFn: fetchUnmatchedPayments, refetchOnWindowFocus: true });
