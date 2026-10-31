'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import AdminCard from '@/components/admin/ui/AdminCard';
import AdminFormField, { inputClass } from '@/components/admin/ui/AdminFormField';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Heading2, List, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/admin-error';
import { fetchLegalPage, updateLegalPage } from '@/lib/admin-api/legal';
import { LEGAL_DEFAULTS, isLegalSlug } from '@/lib/legal-pages';

const toolbarBtn = (active: boolean) =>
  `p-1.5 rounded-sm transition-colors ${active ? 'bg-olive/20' : 'hover:bg-olive/10'}`;

export default function AdminLegalPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!isLegalSlug(slug)) {
    return <p className="font-montserrat text-sm text-forest">Page not found.</p>;
  }
  return <LegalEditor key={slug} slug={slug} />;
}

function LegalEditor({ slug }: { slug: keyof typeof LEGAL_DEFAULTS }) {
  const defaults = LEGAL_DEFAULTS[slug];
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-legal', slug],
    queryFn: () => fetchLegalPage(slug),
  });

  const [title, setTitle] = useState(defaults.title);
  const [content, setContent] = useState(defaults.content);
  const [synced, setSynced] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => setContent(editor.getHTML()),
  });

  // Load the saved text (or the default text if nothing is saved yet) once
  useEffect(() => {
    if (isLoading || !editor || synced) return;
    const text = data?.content?.trim() ? data.content : defaults.content;
    setTitle(data?.title?.trim() || defaults.title);
    setContent(text);
    editor.commands.setContent(text, { emitUpdate: false });
    setSynced(true);
  }, [isLoading, editor, synced, data, defaults]);

  const save = useMutation({
    mutationFn: () => updateLegalPage(slug, { title, content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-legal', slug] });
      toast.success('Page updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update page')),
  });

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-olive size-8" /></div>;
  }

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">{defaults.title} Editor</h1>

      <div className="max-w-3xl space-y-6">
        <AdminCard title="Page content">
          <div className="space-y-4">
            <AdminFormField label="Page title" required>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </AdminFormField>

            <div>
              <label className="block font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-1.5">Text</label>
              <div className="bg-warm border border-olive/15 rounded-t-sm p-1 flex gap-1">
                <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={toolbarBtn(!!editor?.isActive('bold'))}><Bold className="size-4 text-forest" /></button>
                <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={toolbarBtn(!!editor?.isActive('italic'))}><Italic className="size-4 text-forest" /></button>
                <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={toolbarBtn(!!editor?.isActive('heading', { level: 2 }))}><Heading2 className="size-4 text-forest" /></button>
                <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={toolbarBtn(!!editor?.isActive('bulletList'))}><List className="size-4 text-forest" /></button>
              </div>
              <EditorContent
                editor={editor}
                className="min-h-96 bg-cornsilk border border-olive/20 border-t-0 rounded-b-sm p-4 font-montserrat text-sm text-forest prose prose-sm max-w-none focus:outline-none"
              />
            </div>
          </div>
        </AdminCard>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || !title.trim()}
            className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-3 rounded-sm disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
          <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="font-montserrat text-xs text-olive underline">
            View page
          </a>
        </div>
      </div>
    </AdminProtectedRoute>
  );
}
