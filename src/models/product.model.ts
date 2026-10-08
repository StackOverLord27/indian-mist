 
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
  careInstructions?: { text: string; icon: string }[];
  tags?: string[];
  stockQuantity: number;
  trackInventory?: boolean;
  badge?: "New" | "Sale" | "Sold Out" | "";
  isFeatured?: boolean;
  isCategoryFeatured?: boolean;
  shippingInfo?: {
    standard: string;
    express: string;
  };
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
    careInstructions: [{
      text: { type: String, required: true },
      icon: { type: String, default: "droplets" },
    }],
    tags: [{ type: String }],
    shippingInfo: {
      standard: { type: String, default: "3-5 business days" },
      express: { type: String, default: "1-2 business days" },
    },
    stockQuantity: { type: Number, default: 0 },
    trackInventory: { type: Boolean, default: false },
    badge: { type: String, enum: ["New", "Sale", "Sold Out", ""] },
    isFeatured: { type: Boolean, default: false },
    isCategoryFeatured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProductSchema.index({ isFeatured: 1, createdAt: -1 });
ProductSchema.index({ category: 1, order: 1, createdAt: -1 });
ProductSchema.index({ createdAt: -1 });

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
