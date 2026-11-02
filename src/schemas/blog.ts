import { z } from "zod";

export const BlogSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  excerpt: z.string().trim().min(1, "Excerpt is required").max(500, "Excerpt is too long"),
  content: z.string().trim().min(1, "Content is required").max(200_000, "Content is too long"),
  category: z.string().trim().min(1, "Category is required").max(100),
  tags: z.array(z.string().trim().max(60)).max(30).optional().default([]),
  author: z.string().trim().max(100).optional().default("Indian Mist"),
  isPublished: z.boolean().optional().default(false),
});
