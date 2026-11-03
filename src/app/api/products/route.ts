import { NextRequest, NextResponse } from "next/server";
import { getProductListing, parseListingQuery } from "@/lib/product-listing";

export const dynamic = "force-dynamic";

// Every later batch, filter and search of /products. The first batch is built by the page with
// the very same function (lib/product-listing.ts), so the two cannot disagree.
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getProductListing(parseListingQuery(request.nextUrl.searchParams)));
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
