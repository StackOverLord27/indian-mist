import { NextRequest, NextResponse } from "next/server";
import { getPublishedBlogs, BLOGS_PAGE_SIZE, BLOGS_MAX_PAGE_SIZE } from "@/lib/blogs-list";

export const dynamic = "force-dynamic";

const whole = (v: string | null, fallback: number, max: number) => {
  const n = v && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, max) : fallback;
};

// "Load more" and the category filter on /blogs (public): published posts only, no full text.
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const category = sp.get("category")?.trim().slice(0, 80) || undefined;
    return NextResponse.json(
      await getPublishedBlogs({
        page: whole(sp.get("page"), 1, 1000),
        limit: whole(sp.get("limit"), BLOGS_PAGE_SIZE, BLOGS_MAX_PAGE_SIZE),
        category,
      }),
    );
  } catch (error) {
    console.error("Blogs API error:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}
