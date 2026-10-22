'use client';

import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, Trash2, UploadCloud } from 'lucide-react';
import AdminCard from '@/components/admin/ui/AdminCard';
import { getApiErrorMessage } from '@/lib/admin-error';
import * as api from '@/lib/admin-api/size-chart';

export default function SizeChartCard() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useQuery({ queryKey: ['admin-size-chart'], queryFn: api.fetchSizeChart });

  const onDone = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ['admin-size-chart'] });
    toast.success(message);
  };

  const uploadMutation = useMutation({
    mutationFn: api.uploadSizeChart,
    onSuccess: () => onDone('Size chart updated'),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to upload size chart')),
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteSizeChart,
    onSuccess: () => onDone('Size chart removed'),
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to remove size chart')),
  });

  const busy = uploadMutation.isPending || deleteMutation.isPending;

  return (
    <AdminCard
      title="Size Chart"
      description="One image shown in a popup on every product that has sizes. Uploading a new one replaces the old."
    >
      {isLoading ? (
        <Loader2 className="animate-spin text-olive size-6" />
      ) : (
        <div className="space-y-4">
          {data?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.url} alt="Size chart" className="max-h-80 rounded-sm border border-olive/15" />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-sm hover:bg-olive transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {uploadMutation.isPending ? <Loader2 className="animate-spin size-4" /> : <UploadCloud className="size-4" />}
              {data?.url ? 'Replace image' : 'Upload image'}
            </button>
            {data?.url && (
              <button
                type="button"
                disabled={busy}
                onClick={() => deleteMutation.mutate()}
                className="font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-sm border border-copper/40 text-copper hover:bg-copper/10 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="size-4" /> Remove
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg, image/png, image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate(file);
              e.target.value = '';
            }}
          />
        </div>
      )}
    </AdminCard>
  );
}
