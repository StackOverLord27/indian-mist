import { adminAxios } from '../admin-axios';

export type FailedEmailRow = {
  id: string;
  type: string;
  attempts: number;
  permanent: boolean;
  lastErrorCode: string | null;
  createdAt: string;
  canResend: boolean;
};

export const fetchFailedEmails = async () => {
  const { data } = await adminAxios.get<{ emails: FailedEmailRow[]; permanentFailures: number }>('/api/admin/emails');
  return data;
};

export const resendFailedEmail = async (id: string) => {
  await adminAxios.post(`/api/admin/emails/${id}/resend`);
};
