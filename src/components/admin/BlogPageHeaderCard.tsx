'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import AdminCard from '@/components/admin/ui/AdminCard';
import AdminFormField, { inputClass } from '@/components/admin/ui/AdminFormField';
import { useSiteSettings, useUpdateSettings } from '@/hooks/admin/useSiteSettings';
import { settingsForSection } from '@/lib/admin-api/settings';
import { BLOG_HEADER_DEFAULTS, BLOG_HEADING_WHEN_EMPTY } from '@/lib/blog-page-header';
import type { BlogPageSettings } from '@/types/admin';

type Form = Required<BlogPageSettings>;

// Never saved (a missing field) starts with the wording the page shows today
const fromSaved = (saved?: BlogPageSettings): Form => ({
  eyebrow: saved?.eyebrow ?? BLOG_HEADER_DEFAULTS.eyebrow,
  heading: saved?.heading ?? BLOG_HEADER_DEFAULTS.heading,
  subtitle: saved?.subtitle ?? BLOG_HEADER_DEFAULTS.subtitle,
});

export default function BlogPageHeaderCard() {
  const { data, isLoading } = useSiteSettings();
  const update = useUpdateSettings();
  const [form, setForm] = useState<Form>(fromSaved());

  useEffect(() => {
    if (data) setForm(fromSaved(data.blogPageSettings));
  }, [data]);

  const set = (field: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    // This card owns the blog page section only: other pages' settings are not sent
    update.mutate(settingsForSection({ blogPageSettings: form }, 'blogs'));
  };

  return (
    <AdminCard
      title="Blog page header"
      description={`The green header at the top of the blog page. Leave a line empty to hide it (the heading shows "${BLOG_HEADING_WHEN_EMPTY}" when empty).`}
      action={
        <a
          href="/blogs"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-olive hover:text-forest transition-colors"
        >
          View live page <ExternalLink className="size-3.5" />
        </a>
      }
      className="mb-6"
    >
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-olive size-6" />
        </div>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <AdminFormField label="Small line above the heading">
            <input value={form.eyebrow} onChange={set('eyebrow')} maxLength={100} className={inputClass} placeholder="e.g. Indian Mist Journal" />
          </AdminFormField>
          <AdminFormField label="Heading">
            <input value={form.heading} onChange={set('heading')} maxLength={200} className={inputClass} placeholder="e.g. From the Trail" />
          </AdminFormField>
          <AdminFormField label="Sentence under the heading">
            <textarea value={form.subtitle} onChange={set('subtitle')} maxLength={500} className={`${inputClass} resize-y h-20`} placeholder="One or two sentences about the blog" />
          </AdminFormField>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={update.isPending}
              className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-8 py-3 rounded-sm hover:bg-olive transition-colors flex items-center justify-center min-w-[150px] disabled:opacity-60"
            >
              {update.isPending ? <Loader2 className="animate-spin size-4" /> : 'Save header'}
            </button>
          </div>
        </form>
      )}
    </AdminCard>
  );
}
