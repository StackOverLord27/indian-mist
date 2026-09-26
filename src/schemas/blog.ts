import { z } from "zod";

export const BlogSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  excerpt: z.string().min(1, "Excerpt is required").max(500),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
  tags: z.array(z.string()).optional().default([]),
  author: z.string().optional().default("Indian Mist"),
  isPublished: z.boolean().optional().default(false),
});
