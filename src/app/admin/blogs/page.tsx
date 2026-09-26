'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import AdminCard from '@/components/admin/ui/AdminCard';
import { useAdminBlogs, useDeleteBlog } from '@/hooks/admin/useAdminBlogs';
import { AdminBlog } from '@/types/admin';
import { Plus, Pencil, Trash2, Eye, FileText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function AdminBlogsPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const { data, isLoading } = useAdminBlogs({ status: statusFilter });
  const deleteBlog = useDeleteBlog();

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Delete "${title}"? This action cannot be undone.`)) {
      deleteBlog.mutate(id);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <AdminProtectedRoute>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-merriweather text-2xl text-forest">Blog Posts</h1>
          <p className="font-montserrat text-xs text-forest/60 mt-1">
            Manage your blog content
          </p>
        </div>
        <Link
          href="/admin/blogs/new"
          className="inline-flex items-center gap-2 bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-sm hover:bg-olive transition-colors"
        >
          <Plus className="size-4" />
          New Post
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6">
        {[
          { label: 'All', value: undefined },
          { label: 'Published', value: 'published' },
          { label: 'Drafts', value: 'draft' },
        ].map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.value)}
            className={`font-montserrat text-xs font-medium uppercase tracking-wide px-4 py-2 rounded-sm transition-colors ${
              statusFilter === tab.value
                ? 'bg-forest text-cornsilk'
                : 'bg-olive/10 text-forest/60 hover:bg-olive/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Blog list */}
      <AdminCard>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="w-20 h-14 bg-olive/10 rounded-sm" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-olive/10 rounded w-1/2" />
                  <div className="h-3 bg-olive/10 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : !data?.blogs?.length ? (
          <div className="py-16 text-center">
            <FileText className="size-12 text-olive/20 mx-auto mb-4" />
            <p className="font-merriweather text-lg text-forest mb-1">
              No blog posts yet
            </p>
            <p className="font-montserrat text-xs text-muted-text mb-6">
              Create your first post to get started.
            </p>
            <Link
              href="/admin/blogs/new"
              className="inline-flex items-center gap-2 bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-sm hover:bg-olive transition-colors"
            >
              <Plus className="size-4" />
              Create Post
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-olive/10">
            {data.blogs.map((blog: AdminBlog) => (
              <div
                key={blog._id}
                className="flex items-center gap-4 py-4 first:pt-0 last:pb-0 group"
              >
                {/* Cover thumbnail */}
                <div className="w-20 h-14 flex-shrink-0 rounded-sm overflow-hidden bg-olive/10">
                  {blog.coverImage?.url ? (
                    <img
                      src={blog.coverImage.url}
                      alt={blog.coverImage.alt || blog.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="size-5 text-olive/30" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-merriweather text-sm text-forest truncate">
                    {blog.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-block font-montserrat text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-sm ${
                        blog.isPublished
                          ? 'bg-olive/15 text-olive'
                          : 'bg-clay/15 text-copper'
                      }`}
                    >
                      {blog.isPublished ? 'Published' : 'Draft'}
                    </span>
                    <span className="font-montserrat text-[10px] text-muted-text">
                      {blog.category}
                    </span>
                    <span className="font-montserrat text-[10px] text-muted-text">
                      •
                    </span>
                    <span className="font-montserrat text-[10px] text-muted-text">
                      {formatDate(blog.createdAt)}
                    </span>
                    <span className="font-montserrat text-[10px] text-muted-text">
                      •
                    </span>
                    <span className="font-montserrat text-[10px] text-muted-text">
                      {blog.readTime} min read
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {blog.isPublished && (
                    <Link
                      href={`/blogs/${blog.slug}`}
                      target="_blank"
                      className="p-2 text-olive/60 hover:text-olive hover:bg-olive/10 rounded-sm transition-colors"
                      title="View"
                    >
                      <Eye className="size-4" />
                    </Link>
                  )}
                  <Link
                    href={`/admin/blogs/${blog._id}/edit`}
                    className="p-2 text-olive/60 hover:text-olive hover:bg-olive/10 rounded-sm transition-colors"
                    title="Edit"
                  >
                    <Pencil className="size-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(blog._id, blog.title)}
                    className="p-2 text-copper/60 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {/* Pagination info */}
      {data && data.total > 0 && (
        <p className="font-montserrat text-xs text-muted-text mt-4 text-center">
          Showing {data.blogs.length} of {data.total} post{data.total !== 1 ? 's' : ''}
        </p>
      )}
    </AdminProtectedRoute>
  );
}
