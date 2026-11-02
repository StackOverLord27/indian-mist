import { NextRequest } from "next/server";
import { isBlocked, recordFailure } from "@/lib/attempt-limit";
import type { SiteSettings } from "@/types/admin";
import { withDB, errorResponse, successResponse } from "@/lib/api-helpers";
import Settings from "@/models/settings.model";
import { normalizePromoCode, findPromo, countPaidPromoUses, promoDiscount } from "@/lib/promo";

export const POST = withDB(async (req: NextRequest) => {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId)
      return errorResponse("Please login to apply a promo code", 401);

    let body: { code?: unknown; subtotal?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid request", 400);
    }
    const { code, subtotal } = body;

    if (!code || typeof code !== "string") {
      return errorResponse("Promo code is required", 400);
    }
    if (typeof subtotal !== "number" || !Number.isFinite(subtotal) || subtotal < 0) {
      return errorResponse("Invalid subtotal", 400);
    }

    const normalizedCode = normalizePromoCode(code);

    // Limit how many wrong codes one account can try
    const guessKey = `promo:${userId}`;
    if (await isBlocked(guessKey, 15)) {
      return errorResponse("Too many invalid promo codes. Please try again in 10 minutes.", 429);
    }

    const settings = await Settings.findOne().lean<SiteSettings>();
    const promoCodes = settings?.pricingSettings?.promoCodes || [];
    const promo = findPromo(promoCodes, normalizedCode);

    if (!promo) {
      await recordFailure(guessKey, 10 * 60);
      return errorResponse("Invalid promo code", 400);
    }
    if (!promo.isActive) {
      return errorResponse("This promo code is no longer active", 400);
    }

    // Check expiry
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return errorResponse("This promo code has expired", 400);
    }

    // Check minimum order value
    if (promo.minOrderValue && subtotal < promo.minOrderValue) {
      return errorResponse(
        `This promo code requires a minimum order of ₹${promo.minOrderValue}`,
        400,
      );
    }

    // Check global usage limit (maxUses: 0 = unlimited)
    if (promo.maxUses && promo.maxUses > 0) {
      const totalUsageCount = await countPaidPromoUses(promo.code);
      if (totalUsageCount >= promo.maxUses) {
        return errorResponse(
          "This promo code has reached its usage limit",
          400,
        );
      }
    }

    // Check per-user usage limit (maxUsesPerUser: default 1)
    const maxPerUser = promo.maxUsesPerUser ?? 1;
    if (maxPerUser > 0) {
      const userUsageCount = await countPaidPromoUses(promo.code, { userId });
      if (userUsageCount >= maxPerUser) {
        return errorResponse("You have already used this promo code", 400);
      }
    }

    // Calculate discount
    const discountAmount = promoDiscount(promo, subtotal);

    return successResponse({
      code: promo.code,
      discountAmount,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
    });
  } catch (error) {
    console.error("Failed to apply promo code:", error);
    return errorResponse("Failed to apply promo code", 500);
  }
});
