import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { Collection } from "@/models/collection.model";
import { COLLECTION_MAX_PAGE_SIZE, COLLECTION_PAGE_SIZE, getCollectionBatch } from "@/lib/collection-products";

export const dynamic = "force-dynamic";

const whole = (v: string | null, fallback: number, max: number) => {
  const n = v && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, max) : fallback;
};

// "Load more" on a collection's page: the next batch of that collection's products (public).
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const sp = request.nextUrl.searchParams;
    const page = whole(sp.get("page"), 1, 1000);
    const limit = whole(sp.get("limit"), COLLECTION_PAGE_SIZE, COLLECTION_MAX_PAGE_SIZE);

    await dbConnect();
    const collection = await Collection.findOne({ slug, isActive: true }).select("products").lean<{ products: string[] }>();
    if (!collection) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

    return NextResponse.json(await getCollectionBatch(collection.products ?? [], page, limit));
  } catch (error) {
    console.error("Collection products API error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
