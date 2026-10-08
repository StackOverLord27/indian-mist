'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import AdminCard from '@/components/admin/ui/AdminCard';
import { useAdminBlog, useUpdateBlog } from '@/hooks/admin/useAdminBlogs';
import { ArrowLeft, Upload, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, useEffect, use } from 'react';

import BlogCategorySelect from '@/components/admin/BlogCategorySelect';

export default function AdminEditBlogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: blog, isLoading } = useAdminBlog(id);
  const updateBlog = useUpdateBlog(id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [author, setAuthor] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverAlt, setCoverAlt] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Populate form when blog data loads
  useEffect(() => {
    if (blog && !initialized) {
      setTitle(blog.title);
      setExcerpt(blog.excerpt);
      setContent(blog.content);
      setCategory(blog.category);
      setTagsInput(blog.tags?.join(', ') || '');
      setAuthor(blog.author);
      setIsPublished(blog.isPublished);
      setCoverPreview(blog.coverImage?.url || null);
      setCoverAlt(blog.coverImage?.alt || '');
      setInitialized(true);
    }
  }, [blog, initialized]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const removeCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('title', title);
    formData.append('excerpt', excerpt);
    formData.append('content', content);
    formData.append('category', category);
    formData.append('author', author);
    formData.append('isPublished', String(isPublished));
    formData.append(
      'tags',
      JSON.stringify(
        tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      )
    );
    if (coverFile) {
      formData.append('file', coverFile);
      formData.append('coverImageAlt', coverAlt || title);
    } else if (coverAlt) {
      formData.append('coverImageAlt', coverAlt);
    }

    updateBlog.mutate(formData);
  };

  if (isLoading) {
    return (
      <AdminProtectedRoute>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-olive size-8" />
        </div>
      </AdminProtectedRoute>
    );
  }

  return (
    <AdminProtectedRoute>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/blogs"
          className="p-2 text-forest/60 hover:text-forest hover:bg-olive/10 rounded-sm transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="font-merriweather text-2xl text-forest">Edit Blog Post</h1>
          <p className="font-montserrat text-xs text-forest/60 mt-1">
            Update &ldquo;{blog?.title}&rdquo;
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Main content column */}
        <div className="space-y-6">
          {/* Title */}
          <AdminCard>
            <label className="block font-montserrat text-xs uppercase tracking-wider text-forest/60 font-semibold mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter blog post title..."
              required
              className="w-full font-merriweather text-xl text-forest bg-transparent border-b border-olive/20 focus:border-olive outline-none pb-2 placeholder:text-forest/20"
            />
          </AdminCard>

          {/* Excerpt */}
          <AdminCard>
            <label className="block font-montserrat text-xs uppercase tracking-wider text-forest/60 font-semibold mb-2">
              Excerpt *
            </label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="A brief summary that appears on blog cards..."
              required
              rows={3}
              maxLength={500}
              className="w-full font-montserrat text-sm text-forest bg-transparent border border-olive/15 rounded-sm p-3 focus:border-olive outline-none resize-none placeholder:text-forest/20"
            />
            <p className="font-montserrat text-[10px] text-muted-text mt-1 text-right">
              {excerpt.length}/500
            </p>
          </AdminCard>

          {/* Content */}
          <AdminCard>
            <label className="block font-montserrat text-xs uppercase tracking-wider text-forest/60 font-semibold mb-2">
              Content *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your blog post content here..."
              required
              rows={16}
              className="w-full font-montserrat text-sm text-forest bg-transparent border border-olive/15 rounded-sm p-3 focus:border-olive outline-none resize-y placeholder:text-forest/20 leading-relaxed"
            />
          </AdminCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publish */}
          <AdminCard>
            <div className="flex items-center justify-between mb-4">
              <label className="font-montserrat text-xs uppercase tracking-wider text-forest/60 font-semibold">
                Status
              </label>
              <button
                type="button"
                onClick={() => setIsPublished(!isPublished)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isPublished ? 'bg-olive' : 'bg-olive/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-cornsilk transition-transform ${
                    isPublished ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="font-montserrat text-xs text-muted-text">
              {isPublished
                ? 'This post will be visible to everyone.'
                : 'This post is saved as a draft.'}
            </p>

            <button
              type="submit"
              disabled={updateBlog.isPending}
              className="mt-4 w-full bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider py-3 rounded-sm hover:bg-olive transition-colors disabled:opacity-50"
            >
              {updateBlog.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </AdminCard>

          {/* Cover Image */}
          <AdminCard title="Cover Image" description="Recommended: 1600 × 1000 px (16:10). Shown in full on the blog pages, so nothing important is cut off.">
            {coverPreview ? (
              <div className="relative">
                <img
                  src={coverPreview}
                  alt="Cover preview"
                  className="w-full h-40 object-cover rounded-sm"
                />
                <button
                  type="button"
                  onClick={removeCover}
                  className="absolute top-2 right-2 p-1 bg-forest/80 text-cornsilk rounded-sm hover:bg-forest transition-colors"
                >
                  <X className="size-4" />
                </button>
                <input
                  type="text"
                  value={coverAlt}
                  onChange={(e) => setCoverAlt(e.target.value)}
                  placeholder="Image alt text..."
                  className="mt-3 w-full font-montserrat text-xs text-forest bg-transparent border-b border-olive/15 focus:border-olive outline-none pb-1 placeholder:text-forest/20"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-olive/20 rounded-sm flex flex-col items-center justify-center gap-2 hover:border-olive/40 transition-colors"
              >
                <Upload className="size-6 text-olive/40" />
                <span className="font-montserrat text-xs text-muted-text">
                  Click to upload cover image
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </AdminCard>

          {/* Category */}
          <AdminCard title="Category">
            <BlogCategorySelect
              value={category}
              onChange={setCategory}
              required
            />
          </AdminCard>

          {/* Author */}
          <AdminCard title="Author">
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author name"
              className="w-full font-montserrat text-sm text-forest bg-transparent border-b border-olive/15 focus:border-olive outline-none pb-1 placeholder:text-forest/20"
            />
          </AdminCard>

          {/* Tags */}
          <AdminCard title="Tags">
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="outdoor, sustainability, gear..."
              className="w-full font-montserrat text-xs text-forest bg-transparent border-b border-olive/15 focus:border-olive outline-none pb-1 placeholder:text-forest/20"
            />
            <p className="font-montserrat text-[10px] text-muted-text mt-1">
              Separate with commas
            </p>
          </AdminCard>
        </div>
      </form>
    </AdminProtectedRoute>
  );
}
