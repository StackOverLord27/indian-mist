'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import axios from 'axios';

export default function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const checkAuth = async () => {
      try {
        const res = await axios.get('/api/auth/me');
        if (res.data?.user?.role === 'admin') {
          if (!isCancelled) setIsAuthorized(true);
          return;
        } else {
          if (pathname !== '/admin/login') {
            router.push('/admin/login');
          }
        }
      } catch (err) {
        // If 401, attempt silent token refresh using the refresh token cookie
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          try {
            await axios.post('/api/auth/refresh');
            const retryRes = await axios.get('/api/auth/me');
            if (retryRes.data?.user?.role === 'admin') {
              if (!isCancelled) setIsAuthorized(true);
              return;
            }
          } catch {
            // Refresh failed, token is genuinely invalid
          }
        } else if (axios.isAxiosError(err) && err.response?.status === 429) {
          // If rate limited, don't boot an admin if localStorage confirms their session
          const adminUser = localStorage.getItem('im_admin_user');
          if (adminUser) {
            try {
              const u = JSON.parse(adminUser);
              if (u.role === 'admin') {
                if (!isCancelled) setIsAuthorized(true);
                return;
              }
            } catch {}
          }
        }

        // Only redirect if not already on login page
        if (!isCancelled && pathname !== '/admin/login') {
          router.push('/admin/login');
        }
      }
    };

    checkAuth();

    return () => {
      isCancelled = true;
    };
  }, [router, pathname]);

  if (!isAuthorized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-warm">
        <Loader2 className="animate-spin text-olive size-12" />
      </div>
    );
  }

  return <>{children}</>;
}
