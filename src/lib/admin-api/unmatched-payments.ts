import { adminAxios } from '../admin-axios';

export type UnmatchedPaymentRow = {
  _id: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount?: number;
  source: 'webhook' | 'verify-payment';
  seen: number;
  createdAt: string;
};

export const fetchUnmatchedPayments = async () => {
  const { data } = await adminAxios.get<{ count: number; payments: UnmatchedPaymentRow[] }>('/api/admin/unmatched-payments');
  return data;
};
