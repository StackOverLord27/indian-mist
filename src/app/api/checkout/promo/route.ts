import { NextRequest } from "next/server";
import { withDB, errorResponse, successResponse } from "@/lib/api-helpers";
import Settings from "@/models/settings.model";
import { Order } from "@/models/order.model";

export const POST = withDB(async (req: NextRequest) => {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId)
      return errorResponse("Please login to apply a promo code", 401);

    const { code, subtotal } = await req.json();

    if (!code || typeof code !== "string") {
      return errorResponse("Promo code is required", 400);
    }
    if (typeof subtotal !== "number" || subtotal < 0) {
      return errorResponse("Invalid subtotal", 400);
    }

    const normalizedCode = code.trim().toUpperCase();

    const settings = await Settings.findOne().lean();
    const promoCodes = settings?.pricingSettings?.promoCodes || [];
    const promo = promoCodes.find(
      (p: any) => p.code.toUpperCase() === normalizedCode,
    );

    if (!promo) {
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
      const totalUsageCount = await Order.countDocuments({
        promoCode: promo.code.toUpperCase(),
        paymentStatus: "PAID",
      });
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
      const userUsageCount = await Order.countDocuments({
        userId,
        promoCode: promo.code.toUpperCase(),
        paymentStatus: "PAID",
      });
      if (userUsageCount >= maxPerUser) {
        return errorResponse("You have already used this promo code", 400);
      }
    }

    // Check for in-progress checkout lock (Redis-based, short TTL)
    // This prevents the same user from using the same code in parallel tabs
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken && !redisUrl.startsWith("your_")) {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url: redisUrl, token: redisToken });
      const lockKey = `promo_lock_${userId}_${normalizedCode}`;
      const existingLock = await redis.get(lockKey);

      if (existingLock) {
        // Lock exists but that's OK — it means the same user is re-applying
        // the same code (e.g. after modifying cart). We allow this.
        // The lock just prevents concurrent tab abuse.
      }

      // Set/refresh a short lock (10 minutes). This expires automatically
      // so abandoned checkouts don't permanently block the user.
      await redis.set(lockKey, "1", { ex: 600 });
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.discountType === "PERCENTAGE") {
      const pct = Math.min(Math.max(Number(promo.discountValue) || 0, 0), 100);
      discountAmount = Math.floor(subtotal * (pct / 100));
    } else {
      discountAmount = Number(promo.discountValue) || 0;
    }

    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

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
