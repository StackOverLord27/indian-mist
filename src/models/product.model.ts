/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  category: string;
  price: number;
  originalPrice?: number;
  images: { url: string; publicId: string; alt: string; isPrimary: boolean }[];
  categoryCoverImage?: string;
  sizes: string[];
  colors: string[];
  features?: string[];
  materials?: string[];
  tags?: string[];
  stockQuantity: number;
  badge?: "New" | "Sale" | "Sold Out" | "";
  isFeatured?: boolean;
  isCategoryFeatured?: boolean;
  order?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    category: { type: String, required: true, index: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        alt: { type: String, default: "" },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    categoryCoverImage: { type: String, default: "" },
    sizes: [{ type: String }],
    colors: [{ type: String }],
    features: [{ type: String }],
    materials: [{ type: String }],
    tags: [{ type: String }],
    stockQuantity: { type: Number, default: 0 },
    badge: { type: String, enum: ["New", "Sale", "Sold Out", ""] },
    isFeatured: { type: Boolean, default: false },
    isCategoryFeatured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProductSchema.pre("validate", function (this: any) {
  if (!this.slug && this.name) {
    this.slug = (this.name as string)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
});

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);
