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

export const resolveUnmatchedPayment = async (id: string) => {
  await adminAxios.patch(`/api/admin/unmatched-payments/${id}`);
};

/** Refunds waiting for the admin (cancelled paid orders not yet marked refunded), from the orders list's tab counts. */
export const fetchRefundPendingCount = async () => {
  const { data } = await adminAxios.get<{ statusCounts: Record<string, number> }>('/api/admin/orders', {
    params: { status: 'REFUND_PENDING', limit: 1 },
  });
  return data.statusCounts?.REFUND_PENDING ?? 0;
};

export const fetchUnmatchedPayments = async () => {
  const { data } = await adminAxios.get<{ count: number; payments: UnmatchedPaymentRow[] }>('/api/admin/unmatched-payments');
  return data;
};
