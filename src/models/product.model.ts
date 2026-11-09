 
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
  colorName?: string;
  colorHex?: string;
  colorGroup?: string;
  features?: string[];
  materials?: string[];
  careInstructions?: { text: string; icon: string }[];
  tags?: string[];
  /** Optional second list next to the highlights ("Ideal for", "Wear it on"...): its heading and items, both typed by the admin */
  idealForHeading?: string;
  idealFor?: string[];
  stockQuantity: number;
  sizeStock?: { size: string; quantity: number }[];
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
    colorName: { type: String, default: "" },
    colorHex: { type: String, default: "" },
    // Products sharing a colorGroup are shown to each other as colour swatches
    colorGroup: { type: String, default: "", index: true },
    features: [{ type: String }],
    materials: [{ type: String }],
    careInstructions: [{
      text: { type: String, required: true },
      icon: { type: String, default: "droplets" },
    }],
    tags: [{ type: String }],
    idealForHeading: { type: String }, // no default: shown only when the admin typed one
    idealFor: [{ type: String }],
    shippingInfo: {
      standard: { type: String, default: "" },
      express: { type: String, default: "" },
    },
    // Total units. For products with per-size stock this is kept equal to the sum of sizeStock.
    stockQuantity: { type: Number, default: 0 },
    // Units per size, used only when trackInventory is on and the product has sizes
    sizeStock: [{ _id: false, size: { type: String, required: true }, quantity: { type: Number, default: 0 } }],
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
// The admin product list and the reorder route (lib/product-sort.ts PRODUCT_SORT, no filter)
ProductSchema.index({ order: 1, createdAt: -1, _id: 1 });

ProductSchema.pre("validate", function (this: IProduct) {
  if (!this.slug && this.name) {
    this.slug = (this.name as string)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
});

// In development the compiled model stays cached between code reloads, so a field added to the schema
// would be ignored and silently dropped on save until the dev server is restarted. Rebuild it when
// not in production (same guard as the About and Order models).
if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.Product;
}

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);
