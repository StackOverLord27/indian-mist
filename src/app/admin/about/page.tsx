'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { useAboutContent, useUpdateAbout } from '@/hooks/admin/useAboutPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Heading2, List, Loader2, X, Plus, ArrowUp, ArrowDown, ExternalLink, ImagePlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import AdminFormField, { inputClass } from '@/components/admin/ui/AdminFormField';
import type { AboutContent, AboutImage } from '@/types/admin';
import AdminCard from '@/components/admin/ui/AdminCard';
import ImageUploadZone from '@/components/admin/ui/ImageUploadZone';
import { adminAxios } from '@/lib/admin-axios';
import toast from 'react-hot-toast';
import { resolveAbout, type ResolvedAbout } from '@/lib/about-content';

const MAX_GALLERY = 5;

const tabClass =
  'font-montserrat text-xs uppercase tracking-wider data-[state=active]:bg-forest data-[state=active]:text-cornsilk';

type Section = NonNullable<AboutContent['customSections']>[number];

async function uploadImage(file: File): Promise<{ url: string; publicId: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('context', 'about');
  const { data } = await adminAxios.post('/api/admin/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return { url: data.url, publicId: data.publicId };
}

export default function AdminAboutPage() {
  const { data, isLoading } = useAboutContent();
  const updateMutation = useUpdateAbout();
  const [isUploading, setIsUploading] = useState(false);
  const [form, setForm] = useState<ResolvedAbout | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const editorSynced = useRef(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setForm(f => (f ? { ...f, story: { ...f.story, body: editor.getHTML() } } : f));
    },
  });

  // Load the saved content (with the page's own defaults filled in) into the form
  useEffect(() => {
    if (!data || !editor) return;
    setForm(resolveAbout(data));
    editorSynced.current = false;
  }, [data, editor]);

  // Put the story text into the editor once the form (and so the editor itself) is on screen
  useEffect(() => {
    if (!form || !editor || editorSynced.current) return;
    editor.commands.setContent(form.story.body, { emitUpdate: false });
    editorSynced.current = true;
  }, [form, editor]);

  if (isLoading || !form) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-olive size-8" /></div>;
  }

  const patch = <K extends keyof ResolvedAbout>(key: K, value: Partial<ResolvedAbout[K]>) =>
    setForm(f => (f ? { ...f, [key]: { ...(f[key] as object), ...(value as object) } } : f));

  const handleSave = () => {
    const payload: AboutContent = {
      hero: form.hero,
      story: form.story,
      drivesUs: form.values,
      gallery: form.gallery,
      cta: form.cta,
      customSections: form.extraSections.map((s, i) => ({ ...s, order: i })),
      // The old combined text now lives in Hero + Story, so clear it
      mission: { heading: '', body: '' },
    };
    updateMutation.mutate(payload);
  };

  const saveButton = (label: string) => (
    <div className="mt-6 flex justify-end">
      <button
        onClick={handleSave}
        disabled={updateMutation.isPending || isUploading}
        className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-2.5 rounded-sm hover:bg-olive transition-colors flex items-center gap-2 disabled:opacity-60"
      >
        {updateMutation.isPending && <Loader2 className="animate-spin size-4" />} {label}
      </button>
    </div>
  );

  // ---- values cards
  const addCard = () => patch('values', { cards: [...form.values.cards, { icon: 'Globe2', title: '', body: '' }] });
  const removeCard = (idx: number) => patch('values', { cards: form.values.cards.filter((_, i) => i !== idx) });
  const updateCard = (idx: number, field: 'title' | 'body', val: string) =>
    patch('values', { cards: form.values.cards.map((c, i) => (i === idx ? { ...c, [field]: val } : c)) });

  // ---- extra sections
  const addSection = () =>
    setForm(f => f && {
      ...f,
      extraSections: [
        ...f.extraSections,
        { type: 'image-text-split', heading: '', body: '', imageUrl: '', imagePublicId: '', imageAlt: '', imageAlignment: 'left', order: f.extraSections.length },
      ],
    });
  const updateSection = (idx: number, changes: Partial<Section>) =>
    setForm(f => f && { ...f, extraSections: f.extraSections.map((s, i) => (i === idx ? { ...s, ...changes } : s)) });
  const removeSection = (idx: number) =>
    setForm(f => f && { ...f, extraSections: f.extraSections.filter((_, i) => i !== idx) });

  // ---- gallery
  const images = form.gallery.images;
  const setImages = (next: AboutImage[]) => patch('gallery', { images: next });
  const handleGalleryFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_GALLERY - images.length;
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) toast.error(`Only ${MAX_GALLERY} photos fit the mosaic, extra files were skipped`);
    setIsUploading(true);
    try {
      const uploaded: AboutImage[] = [];
      for (const file of chosen) {
        const { url, publicId } = await uploadImage(file);
        uploaded.push({ url, publicId, alt: '' });
      }
      setImages([...images, ...uploaded]);
      toast.success(`${uploaded.length} photo${uploaded.length > 1 ? 's' : ''} uploaded. Save to publish.`);
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
      if (galleryInput.current) galleryInput.current.value = '';
    }
  };
  const moveImage = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[idx], next[j]] = [next[j], next[idx]];
    setImages(next);
  };

  const toolbarBtn = (active: boolean) =>
    `w-8 h-8 flex items-center justify-center rounded-sm transition-colors ${active ? 'bg-card border border-olive/25' : 'hover:bg-card'}`;

  return (
    <AdminProtectedRoute>
      <div className="flex items-center justify-between gap-4 mb-6 max-w-4xl">
        <h1 className="font-merriweather text-2xl text-forest">About Page Editor</h1>
        <a
          href="/about"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 font-montserrat text-xs font-semibold uppercase tracking-wider text-olive hover:underline"
        >
          View live page <ExternalLink className="size-3.5" />
        </a>
      </div>

      <Tabs defaultValue="hero" className="w-full max-w-4xl">
        <TabsList className="bg-warm border border-olive/15 mb-6 flex-wrap h-auto">
          <TabsTrigger value="hero" className={tabClass}>Hero</TabsTrigger>
          <TabsTrigger value="story" className={tabClass}>Story</TabsTrigger>
          <TabsTrigger value="values" className={tabClass}>Values</TabsTrigger>
          <TabsTrigger value="gallery" className={tabClass}>Photo Mosaic</TabsTrigger>
          <TabsTrigger value="more" className={tabClass}>More Sections</TabsTrigger>
          <TabsTrigger value="cta" className={tabClass}>Call To Action</TabsTrigger>
        </TabsList>

        {/* HERO */}
        <TabsContent value="hero">
          <AdminCard title="Hero (top banner)">
            <div className="space-y-4">
              <AdminFormField label="Small label" hint="Shown above the headline, e.g. About Indian Mist">
                <input value={form.hero.eyebrow} onChange={e => patch('hero', { eyebrow: e.target.value })} className={inputClass} />
              </AdminFormField>
              <AdminFormField label="Headline" required>
                <input value={form.hero.headline} onChange={e => patch('hero', { headline: e.target.value })} className={inputClass} />
              </AdminFormField>
              <AdminFormField label="Lead text" hint="One or two short sentences under the headline. Optional.">
                <textarea value={form.hero.lead} onChange={e => patch('hero', { lead: e.target.value })} className={`${inputClass} h-24 resize-none`} />
              </AdminFormField>
            </div>
            {saveButton("Save Hero")}
          </AdminCard>
        </TabsContent>

        {/* STORY */}
        <TabsContent value="story">
          <AdminCard title="Story (photo + text)">
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <AdminFormField label="Small label" hint="e.g. Our Story">
                  <input value={form.story.eyebrow} onChange={e => patch('story', { eyebrow: e.target.value })} className={inputClass} />
                </AdminFormField>
                <AdminFormField label="Heading" required>
                  <input value={form.story.heading} onChange={e => patch('story', { heading: e.target.value })} className={inputClass} />
                </AdminFormField>
              </div>

              <div>
                <label className="block font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-1.5">Story text</label>
                <div className="bg-warm border border-olive/15 rounded-t-sm p-1 flex gap-1">
                  <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={toolbarBtn(!!editor?.isActive('bold'))}><Bold className="size-4 text-forest" /></button>
                  <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={toolbarBtn(!!editor?.isActive('italic'))}><Italic className="size-4 text-forest" /></button>
                  <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={toolbarBtn(!!editor?.isActive('heading', { level: 2 }))}><Heading2 className="size-4 text-forest" /></button>
                  <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={toolbarBtn(!!editor?.isActive('bulletList'))}><List className="size-4 text-forest" /></button>
                </div>
                <EditorContent
                  editor={editor}
                  className="min-h-48 bg-cornsilk border border-olive/20 border-t-0 rounded-b-sm p-4 font-montserrat text-sm text-forest prose prose-sm focus:outline-none"
                />
              </div>

              <AdminFormField label="Story photo">
                <ImageUploadZone
                  hint="Tall photo works best: about 1200 × 1500 px (4:5)."
                  multiple={false}
                  maxFiles={1}
                  currentImages={form.story.image.url ? [{ url: form.story.image.url, publicId: form.story.image.publicId || form.story.image.url, isPrimary: true }] : []}
                  onRemoveExisting={() => patch('story', { image: { url: '', publicId: '', alt: form.story.image.alt } })}
                  onFilesSelected={async (files) => {
                    if (!files.length) return;
                    setIsUploading(true);
                    try {
                      const { url, publicId } = await uploadImage(files[0]);
                      patch('story', { image: { url, publicId, alt: form.story.image.alt } });
                      toast.success('Image uploaded. Save to publish.');
                    } catch {
                      toast.error('Failed to upload image');
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                />
              </AdminFormField>
              <AdminFormField label="Photo description (alt text)" hint="Describes the photo for screen readers and search engines.">
                <input value={form.story.image.alt} onChange={e => patch('story', { image: { ...form.story.image, alt: e.target.value } })} className={inputClass} />
              </AdminFormField>
            </div>
            {saveButton("Save Story")}
          </AdminCard>
        </TabsContent>

        {/* VALUES */}
        <TabsContent value="values">
          <AdminCard title="Values (numbered cards)">
            <div className="space-y-6">
              <AdminFormField label="Section heading" required>
                <input value={form.values.heading} onChange={e => patch('values', { heading: e.target.value })} className={inputClass} />
              </AdminFormField>

              <div className="space-y-4">
                <label className="block font-montserrat text-xs font-semibold uppercase tracking-wider text-forest">Cards (numbered 01, 02… automatically)</label>
                {form.values.cards.map((card, idx) => (
                  <div key={idx} className="bg-warm/50 border border-olive/15 rounded-md p-4 flex gap-4 items-start">
                    <span className="font-merriweather text-xl text-clay pt-1.5 w-8">{String(idx + 1).padStart(2, '0')}</span>
                    <div className="flex-1 space-y-3">
                      <input value={card.title} onChange={e => updateCard(idx, 'title', e.target.value)} placeholder="Card title" className={inputClass} />
                      <textarea value={card.body} onChange={e => updateCard(idx, 'body', e.target.value)} placeholder="Card text..." className={`${inputClass} h-20 resize-none`} />
                    </div>
                    {form.values.cards.length > 1 && (
                      <button type="button" onClick={() => removeCard(idx)} aria-label="Remove card" className="p-2 text-copper hover:bg-copper/10 rounded-sm">
                        <X className="size-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addCard} className="flex items-center gap-2 font-montserrat text-xs text-olive hover:underline">
                  <Plus className="size-3" /> Add card
                </button>
              </div>
            </div>
            {saveButton("Save Values")}
          </AdminCard>
        </TabsContent>

        {/* GALLERY */}
        <TabsContent value="gallery">
          <AdminCard title="Photo Mosaic">
            <div className="space-y-6">
              <label className="flex items-center gap-3 font-montserrat text-sm text-forest">
                <input
                  type="checkbox"
                  checked={form.gallery.isVisible}
                  onChange={e => patch('gallery', { isVisible: e.target.checked })}
                  className="size-4 accent-olive"
                />
                Show this section on the About page
              </label>

              <div className="grid md:grid-cols-2 gap-4">
                <AdminFormField label="Small label">
                  <input value={form.gallery.eyebrow} onChange={e => patch('gallery', { eyebrow: e.target.value })} className={inputClass} />
                </AdminFormField>
                <AdminFormField label="Heading">
                  <input value={form.gallery.heading} onChange={e => patch('gallery', { heading: e.target.value })} className={inputClass} />
                </AdminFormField>
                <AdminFormField label="Link text" hint="Leave empty to hide the link">
                  <input value={form.gallery.linkLabel} onChange={e => patch('gallery', { linkLabel: e.target.value })} className={inputClass} />
                </AdminFormField>
                <AdminFormField label="Link address">
                  <input value={form.gallery.linkHref} onChange={e => patch('gallery', { linkHref: e.target.value })} className={inputClass} />
                </AdminFormField>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-montserrat text-xs font-semibold uppercase tracking-wider text-forest">
                    Photos ({images.length}/{MAX_GALLERY})
                  </label>
                  <span className="font-montserrat text-xs text-forest/60">Use 3 to 5 photos. The first is the largest tile.</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {images.map((img, idx) => (
                    <div key={`${img.publicId}-${idx}`} className="bg-warm/50 border border-olive/15 rounded-md p-3 flex gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" className="size-24 object-cover rounded-sm shrink-0" />
                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <input
                          value={img.alt}
                          onChange={e => setImages(images.map((x, i) => (i === idx ? { ...x, alt: e.target.value } : x)))}
                          placeholder="Photo description (for screen readers)"
                          className={inputClass}
                        />
                        <div className="flex items-center gap-1 mt-auto">
                          <button type="button" onClick={() => moveImage(idx, -1)} disabled={idx === 0} aria-label="Move earlier" className="p-1.5 rounded-sm hover:bg-card disabled:opacity-30"><ArrowUp className="size-4 text-forest" /></button>
                          <button type="button" onClick={() => moveImage(idx, 1)} disabled={idx === images.length - 1} aria-label="Move later" className="p-1.5 rounded-sm hover:bg-card disabled:opacity-30"><ArrowDown className="size-4 text-forest" /></button>
                          <button type="button" onClick={() => setImages(images.filter((_, i) => i !== idx))} aria-label="Remove photo" className="ml-auto p-1.5 rounded-sm text-copper hover:bg-copper/10"><X className="size-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {images.length < MAX_GALLERY && (
                    <button
                      type="button"
                      onClick={() => galleryInput.current?.click()}
                      disabled={isUploading}
                      className="min-h-[7.5rem] border border-dashed border-olive/30 rounded-md bg-olive/5 hover:bg-olive/10 flex flex-col items-center justify-center gap-2 font-montserrat text-sm text-forest disabled:opacity-60"
                    >
                      {isUploading ? <Loader2 className="animate-spin size-5" /> : <ImagePlus className="size-5" />}
                      {isUploading ? 'Uploading…' : 'Add photos'}
                    </button>
                  )}
                </div>
                <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={e => handleGalleryFiles(e.target.files)} />

                {images.length < 3 && (
                  <p className="font-montserrat text-xs text-copper mt-3">
                    With fewer than 3 photos here, the page shows your homepage carousel photos instead.
                  </p>
                )}
              </div>
            </div>
            {saveButton("Save Mosaic")}
          </AdminCard>
        </TabsContent>

        {/* MORE SECTIONS */}
        <TabsContent value="more">
          <AdminCard title="More Photo + Text Sections">
            <p className="font-montserrat text-xs text-forest/70 mb-4">
              Optional extra rows shown under the Story, each with a photo and text. Leave empty if you don&apos;t need any.
            </p>
            <div className="space-y-6">
              {form.extraSections.map((section, idx) => (
                <div key={idx} className="bg-warm/50 border border-olive/15 rounded-md p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-merriweather text-lg text-forest">Section {idx + 1}</h3>
                    <button type="button" onClick={() => removeSection(idx)} className="text-copper hover:text-red-700 text-sm font-semibold">Remove</button>
                  </div>
                  <AdminFormField label="Heading">
                    <input value={section.heading} onChange={e => updateSection(idx, { heading: e.target.value })} className={inputClass} placeholder="e.g. Crafted in the Wild" />
                  </AdminFormField>
                  <AdminFormField label="Body text">
                    <textarea value={section.body} onChange={e => updateSection(idx, { body: e.target.value })} className={`${inputClass} h-24 resize-none`} placeholder="Write your story here..." />
                  </AdminFormField>
                  <AdminFormField label="Photo side">
                    <select value={section.imageAlignment} onChange={e => updateSection(idx, { imageAlignment: e.target.value as 'left' | 'right' })} className={inputClass}>
                      <option value="left">Photo on left</option>
                      <option value="right">Photo on right</option>
                    </select>
                  </AdminFormField>
                  <AdminFormField label="Photo">
                    <ImageUploadZone
                      hint="Tall photo works best: about 1200 × 1500 px (4:5)."
                      multiple={false}
                      maxFiles={1}
                      currentImages={section.imageUrl ? [{ url: section.imageUrl, publicId: section.imagePublicId || section.imageUrl, isPrimary: true }] : []}
                      onRemoveExisting={() => updateSection(idx, { imageUrl: '', imagePublicId: '' })}
                      onFilesSelected={async (files) => {
                        if (!files.length) return;
                        setIsUploading(true);
                        try {
                          const { url, publicId } = await uploadImage(files[0]);
                          updateSection(idx, { imageUrl: url, imagePublicId: publicId });
                          toast.success('Image uploaded. Save to publish.');
                        } catch {
                          toast.error('Failed to upload image');
                        } finally {
                          setIsUploading(false);
                        }
                      }}
                    />
                  </AdminFormField>
                  <AdminFormField label="Photo description (alt text)">
                    <input value={section.imageAlt} onChange={e => updateSection(idx, { imageAlt: e.target.value })} className={inputClass} />
                  </AdminFormField>
                </div>
              ))}
              <button type="button" onClick={addSection} className="w-full bg-olive/10 text-forest hover:bg-olive/20 px-4 py-4 rounded-md border border-olive/20 border-dashed font-montserrat text-sm font-semibold flex items-center justify-center gap-2">
                <Plus className="size-4" /> Add photo + text section
              </button>
            </div>
            {saveButton("Save Sections")}
          </AdminCard>
        </TabsContent>

        {/* CTA */}
        <TabsContent value="cta">
          <AdminCard title="Call To Action (bottom banner)">
            <div className="space-y-4">
              <AdminFormField label="Heading" required>
                <input value={form.cta.heading} onChange={e => patch('cta', { heading: e.target.value })} className={inputClass} />
              </AdminFormField>
              <AdminFormField label="Subtext">
                <textarea value={form.cta.subtext} onChange={e => patch('cta', { subtext: e.target.value })} className={`${inputClass} h-20 resize-none`} />
              </AdminFormField>
              <div className="grid md:grid-cols-2 gap-4">
                <AdminFormField label="Primary button text">
                  <input value={form.cta.primaryButtonLabel} onChange={e => patch('cta', { primaryButtonLabel: e.target.value })} className={inputClass} />
                </AdminFormField>
                <AdminFormField label="Primary button link">
                  <input value={form.cta.primaryButtonLink || ''} onChange={e => patch('cta', { primaryButtonLink: e.target.value })} className={inputClass} placeholder="/products" />
                </AdminFormField>
                <AdminFormField label="Secondary button text">
                  <input value={form.cta.secondaryButtonLabel} onChange={e => patch('cta', { secondaryButtonLabel: e.target.value })} className={inputClass} />
                </AdminFormField>
                <AdminFormField label="Secondary button link">
                  <input value={form.cta.secondaryButtonLink || ''} onChange={e => patch('cta', { secondaryButtonLink: e.target.value })} className={inputClass} placeholder="/blogs" />
                </AdminFormField>
              </div>
            </div>
            {saveButton("Save CTA")}
          </AdminCard>
        </TabsContent>
      </Tabs>
    </AdminProtectedRoute>
  );
}
