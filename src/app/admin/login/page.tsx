'use client';

import { getApiErrorMessage } from '@/lib/admin-error';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await axios.post('/api/auth/signin', data);
      
      if (response.data.user?.role !== 'admin') {
        toast.error('Access denied. Admin role required.');
        return;
      }

      // Store user info for the admin sidebar/display
      localStorage.setItem('im_admin_user', JSON.stringify(response.data.user));

      toast.success('Signed in successfully!');
      router.push('/admin');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to sign in'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-forest p-4">
      <div className="w-full max-w-md rounded-md bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="font-merriweather text-3xl text-forest mb-2">Indian Mist Admin</h1>
          <p className="font-montserrat text-sm text-forest/70">Sign in to the dashboard</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              {...register('email')}
              className="w-full px-4 py-2.5 bg-cornsilk border border-olive/25 rounded-sm font-montserrat text-sm text-forest outline-none focus:border-olive transition-colors placeholder:text-forest/60/50"
              placeholder="admin@indianmist.com"
            />
            {errors.email && (
              <p className="font-montserrat text-xs text-copper mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-montserrat text-xs font-semibold uppercase tracking-wider text-forest">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="font-montserrat text-xs text-olive hover:text-copper transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              {...register('password')}
              className="w-full px-4 py-2.5 bg-cornsilk border border-olive/25 rounded-sm font-montserrat text-sm text-forest outline-none focus:border-olive transition-colors placeholder:text-forest/60/50"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="font-montserrat text-xs text-copper mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-forest text-cornsilk font-montserrat text-sm font-semibold uppercase tracking-wider py-3 rounded-sm hover:bg-olive transition-colors flex justify-center items-center mt-2"
          >
            {isSubmitting ? <Loader2 className="animate-spin size-5" /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
