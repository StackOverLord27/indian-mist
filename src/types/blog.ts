// A blog post after it has been serialised for pages (dates become strings)
export type BlogPostData = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: { url?: string; alt?: string };
  category: string;
  tags?: string[];
  author?: string;
  readTime?: number;
  publishedAt?: string;
  createdAt: string;
};
