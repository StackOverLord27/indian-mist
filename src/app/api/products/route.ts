import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { Product } from "@/models/product.model";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "12", 10);
    const skip = (page - 1) * limit;

    // Sorting
    const sortParam = searchParams.get("sort") || "featured";
    let sortStage: any = { order: 1, createdAt: -1 }; // Default (Featured)
    
    if (sortParam === "price-low") {
      sortStage = { price: 1 };
    } else if (sortParam === "price-high") {
      sortStage = { price: -1 };
    } else if (sortParam === "name-asc") {
      sortStage = { name: 1 };
    } else if (sortParam === "name-desc") {
      sortStage = { name: -1 };
    }

    // Filtering
    const matchStage: any = {};
    const categoryParam = searchParams.get("category");
    if (categoryParam) {
      matchStage.category = { $in: categoryParam.split(",").filter(Boolean) };
    }

    const badgeParam = searchParams.get("badge");
    if (badgeParam) {
      matchStage.badge = { $in: badgeParam.split(",").filter(Boolean) };
    }

    // Run aggregation
    const result = await Product.aggregate([
      // 1. Match the current filters
      { $match: matchStage },
      
      // 2. Facet for data and dynamic counts
      {
        $facet: {
          data: [
            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit },
            { 
              $project: {
                slug: 1,
                name: 1,
                category: 1,
                price: 1,
                images: 1,
                badge: 1
              }
            }
          ],
          totalCount: [
            { $count: "count" }
          ],
          categories: [
            {
              $group: {
                _id: "$category",
                count: { $sum: 1 }
              }
            },
            {
              $lookup: {
                from: "categories",
                localField: "_id",
                foreignField: "slug",
                as: "categoryDoc"
              }
            },
            {
              $project: {
                _id: 1,
                count: 1,
                name: { $ifNull: [{ $arrayElemAt: ["$categoryDoc.name", 0] }, "$_id"] }
              }
            },
            { $sort: { count: -1 } }
          ],
          badges: [
            {
              $group: {
                _id: "$badge",
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } }
          ]
        }
      }
    ]);

    const facetResult = result[0] || {};
    
    const data = facetResult.data || [];
    const products = data.map((p: any) => ({
      id: p._id?.toString() || "",
      slug: p.slug || "",
      name: p.name || "",
      category: p.category || "",
      price: p.price ? `₹${p.price.toLocaleString("en-IN")}` : "₹0", // format price
      images: (p.images || []).map((img: any) => typeof img === 'string' ? img : img?.url).filter(Boolean),
      badge: p.badge,
    }));

    const totalCountArr = facetResult.totalCount || [];
    const total = totalCountArr[0]?.count || 0;
    
    const catArr = facetResult.categories || [];
    const badgeArr = facetResult.badges || [];

    const facets = {
      categories: catArr.map((c: any) => ({ name: c.name, value: c._id, count: c.count })),
      badges: badgeArr
        .filter((b: any) => b._id) // remove null/undefined badges
        .map((b: any) => ({ name: b._id, value: b._id, count: b.count })),
    };

    return NextResponse.json({
      products,
      facets,
      total,
      hasMore: skip + limit < total,
    });
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
