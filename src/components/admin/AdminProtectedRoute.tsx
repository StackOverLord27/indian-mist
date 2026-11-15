'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import axios from 'axios';

type Status = 'checking' | 'ok' | 'error';

export default function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>('checking');
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setStatus('checking');
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const ok = () => { if (!isCancelled) setStatus('ok'); };
    const toLogin = () => { if (!isCancelled && pathname !== '/admin/login') router.push('/admin/login'); };
    const failed = () => { if (!isCancelled) setStatus('error'); };

    const checkAuth = async () => {
      try {
        const res = await axios.get('/api/auth/me', { timeout: 15000 });
        if (res.data?.user?.role === 'admin') return ok();
        return toLogin(); // signed in, but not as an admin
      } catch (err) {
        // Only a 401 means "not signed in": try to renew once, then go to the login page.
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          try {
            await axios.post('/api/auth/refresh', undefined, { timeout: 15000 });
            const retryRes = await axios.get('/api/auth/me', { timeout: 15000 });
            if (retryRes.data?.user?.role === 'admin') return ok();
            return toLogin();
          } catch (refreshErr) {
            // The session is only definitely over if the server said so (401/403).
            const code = axios.isAxiosError(refreshErr) ? refreshErr.response?.status : undefined;
            if (code === 401 || code === 403) return toLogin();
            return failed();
          }
        }
        // 429, 5xx, timeout, no network, anything else: the session may be fine, so neither
        // an endless spinner nor a redirect: show the error and let the admin retry.
        if (axios.isAxiosError(err) && err.response?.status === 429) {
          try {
            const u = JSON.parse(localStorage.getItem('im_admin_user') ?? 'null');
            if (u?.role === 'admin') return ok(); // rate limited, but this browser was signed in as admin
          } catch {}
        }
        return failed();
      }
    };

    checkAuth();
    return () => { isCancelled = true; };
  }, [router, pathname, attempt]);

  if (status === 'error') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-warm px-6 text-center">
        <p className="text-lg font-medium text-foreground">We could not check your admin session.</p>
        <p className="max-w-md text-sm text-foreground/70">
          This is usually a short connection or server problem. You are not signed out.
        </p>
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-2 rounded-md bg-olive px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <RefreshCw className="size-4" /> Retry
        </button>
      </div>
    );
  }

  if (status !== 'ok') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-warm">
        <Loader2 className="animate-spin text-olive size-12" />
      </div>
    );
  }

  return <>{children}</>;
}
