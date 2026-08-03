'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from '@/lib/query-client';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminTopBar from '@/components/admin/AdminTopBar';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';

  if (isLoginPage) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="bottom-right" toastOptions={{
          duration: 3000,
          success: {
            style: {
              background: '#fdf6e3',
              border: '1px solid rgba(96,108,56,0.2)',
              color: '#283618',
              fontFamily: 'Montserrat, sans-serif',
              fontSize: '13px'
            },
            iconTheme: { primary: '#606c38', secondary: '#fefae0' }
          },
          error: {
            style: {
              background: '#fdf6e3',
              border: '1px solid rgba(188,108,37,0.3)',
              color: '#283618',
              fontFamily: 'Montserrat, sans-serif',
              fontSize: '13px'
            },
            iconTheme: { primary: '#bc6c25', secondary: '#fefae0' }
          }
        }} />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen bg-warm overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto">
          <AdminTopBar />
          <div className="p-6 md:p-8">
            {children}
          </div>
        </main>
      </div>
      <Toaster position="bottom-right" toastOptions={{
        duration: 3000,
        success: {
          style: {
            background: '#fdf6e3',
            border: '1px solid rgba(96,108,56,0.2)',
            color: '#283618',
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '13px'
          },
          iconTheme: { primary: '#606c38', secondary: '#fefae0' }
        },
        error: {
          style: {
            background: '#fdf6e3',
            border: '1px solid rgba(188,108,37,0.3)',
            color: '#283618',
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '13px'
          },
          iconTheme: { primary: '#bc6c25', secondary: '#fefae0' }
        }
      }} />
    </QueryClientProvider>
  );
}
