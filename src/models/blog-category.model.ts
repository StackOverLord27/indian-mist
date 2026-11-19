import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBlogCategory extends Document {
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const BlogCategorySchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

BlogCategorySchema.pre("validate", function (this: IBlogCategory) {
  if (!this.slug && this.name) {
    const generated = (this.name as string)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    this.slug = generated || `cat-${Date.now()}`;
  }
});

// In development the compiled model stays cached between code reloads, so a field added to the schema
// would be dropped on save until the dev server is restarted: rebuild it when not in production.
if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.BlogCategory;
}

export const BlogCategory: Model<IBlogCategory> =
  mongoose.models.BlogCategory ||
  mongoose.model<IBlogCategory>("BlogCategory", BlogCategorySchema);
