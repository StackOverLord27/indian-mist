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
    const checkAuth = async () => {
      try {
        await axios.get('/api/auth/me');
        setIsAuthorized(true);
      } catch (err) {
        // Only redirect if not already on login page
        if (pathname !== '/admin/login') {
          router.push('/admin/login');
        }
      }
    };

    checkAuth();
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
