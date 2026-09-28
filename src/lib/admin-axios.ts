import axios from 'axios';

export const adminAxios = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

adminAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't loop refresh requests
      if (originalRequest.url?.includes('/api/auth/refresh')) {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
          localStorage.removeItem('im_admin_user');
          window.location.href = '/admin/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => adminAxios(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post('/api/auth/refresh');
        processQueue(null);
        return adminAxios(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
          localStorage.removeItem('im_admin_user');
          window.location.href = '/admin/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 403) {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  }
);
