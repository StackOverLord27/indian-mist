import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBlog extends Document {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: {
    url: string;
    publicId: string;
    alt: string;
  };
  category: string;
  tags: string[];
  author: string;
  isPublished: boolean;
  publishedAt?: Date;
  readTime: number;
  createdAt: Date;
  updatedAt: Date;
}

const BlogSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, required: true },
    content: { type: String, required: true },
    coverImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      alt: { type: String, default: "" },
    },
    category: { type: String, required: true, index: true },
    tags: [{ type: String }],
    author: { type: String, default: "Indian Mist" },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    readTime: { type: Number, default: 5 },
  },
  { timestamps: true }
);

// Auto-generate slug from title
BlogSchema.pre("validate", function (this: IBlog) {
  if (!this.slug && this.title) {
    this.slug = (this.title as string)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
});

// Auto-set publishedAt when publishing
BlogSchema.pre("save", function (this: IBlog) {
  if (this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

// Auto-calculate read time from content (avg 200 words/min)
BlogSchema.pre("save", function (this: IBlog) {
  if (this.content) {
    const wordCount = this.content.replace(/<[^>]*>/g, "").split(/\s+/).length;
    this.readTime = Math.max(1, Math.ceil(wordCount / 200));
  }
});

export const Blog: Model<IBlog> =
  mongoose.models.Blog || mongoose.model<IBlog>("Blog", BlogSchema);
