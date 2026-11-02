import { jsonFormField } from "@/lib/api-helpers";
import { slugify } from "@/lib/slugify";
import { buildSizeStock } from "@/lib/size-stock";
import type { IProduct } from "@/models/product.model";

const jsonField = jsonFormField;

type Existing = Pick<
  IProduct,
  | "name" | "category" | "price" | "originalPrice" | "description" | "badge" | "tags" | "sizes" | "colorName"
  | "colorHex" | "colorGroup" | "features" | "materials" | "careInstructions" | "shippingInfo" | "isFeatured"
  | "trackInventory" | "stockQuantity" | "sizeStock"
>;

/**
 * Turns the product form's fields into the object the ProductSchema checks.
 * On update (`existing` given) every field that was not sent keeps its current value.
 * Nothing here trusts a value: the caller must run the result through ProductSchema and use
 * ONLY the parsed output.
 */
export function productCandidate(fields: Record<string, string>, existing?: Existing) {
  const e = existing;
  const num = (name: string, keep: number | undefined) => {
    const raw = fields[name];
    if (raw === undefined) return keep;
    if (raw.trim() === "") return undefined; // an empty box clears the value
    return Number(raw);
  };

  return {
    name: fields.name?.trim() ?? e?.name,
    category: fields.category ?? e?.category,
    price: fields.price !== undefined && fields.price !== "" ? Number(fields.price) : e?.price ?? NaN,
    originalPrice: num("originalPrice", e?.originalPrice),
    description: fields.description?.trim() ?? e?.description,
    badge: fields.badge ?? e?.badge ?? "",
    tags: jsonField<string[]>(fields, "tags") ?? e?.tags ?? [],
    sizes: jsonField<string[]>(fields, "sizes") ?? e?.sizes ?? [],
    colorName: fields.colorName !== undefined ? fields.colorName.trim() : (e?.colorName ?? ""),
    colorHex: fields.colorHex !== undefined ? fields.colorHex.trim() : (e?.colorHex ?? ""),
    // A colour group is a slug so "Olive Tee" and "olive-tee" are the same group
    colorGroup: fields.colorGroup !== undefined ? slugify(fields.colorGroup) : (e?.colorGroup ?? ""),
    features: jsonField<string[]>(fields, "features") ?? e?.features ?? [],
    materials: jsonField<string[]>(fields, "materials") ?? e?.materials ?? [],
    careInstructions: jsonField<{ text: string; icon: string }[]>(fields, "careInstructions") ?? e?.careInstructions ?? [],
    shippingInfo: jsonField<{ standard?: string; express?: string }>(fields, "shippingInfo") ?? e?.shippingInfo,
    isFeatured: fields.isFeatured !== undefined ? fields.isFeatured === "true" : (e?.isFeatured ?? false),
    trackInventory: fields.trackInventory !== undefined ? fields.trackInventory === "true" : (e?.trackInventory ?? false),
    stockQuantity:
      fields.stockQuantity !== undefined
        ? Math.max(0, Math.floor(Number(fields.stockQuantity) || 0))
        : (e?.stockQuantity ?? 0),
  };
}

/**
 * Per-size stock for the validated product. With stock tracking on and sizes chosen, stock is
 * kept per size and the total is their sum.
 */
export function stockFor(
  parsed: { sizes?: string[]; trackInventory: boolean; stockQuantity: number },
  fields: Record<string, string>,
  existing?: Existing,
) {
  const counts =
    jsonField<Record<string, unknown>>(fields, "sizeStock") ??
    Object.fromEntries((existing?.sizeStock ?? []).map((s) => [s.size, s.quantity]));
  const sizeStock = buildSizeStock(parsed.sizes ?? [], counts, parsed.trackInventory);
  const stockQuantity = sizeStock.length ? sizeStock.reduce((n, s) => n + s.quantity, 0) : parsed.stockQuantity;
  return { sizeStock, stockQuantity };
}
