"use client";

import type { UserData } from "@/components/profile/types";
import { getApiErrorMessage } from "@/lib/admin-error";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkoutSchema, type CheckoutFormValues } from "@/schemas/checkout";
import { ArrowLeft, LockKeyhole, Loader2 } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/utils";
import { usePricingSettings } from "@/hooks/usePricingSettings";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { StepProgress } from "@/components/checkout/StepProgress";
import { ShippingForm } from "@/components/checkout/ShippingForm";
import { CheckoutOrderSummary } from "@/components/checkout/CheckoutOrderSummary";
import { CheckoutSuccess } from "@/components/checkout/CheckoutSuccess";

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type RazorpayFailureResponse = { error?: { description?: string } };
type RazorpayCheckout = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayFailureResponse) => void) => void;
};

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function CheckoutPageClient() {
  const router = useRouter();
  const {
    items,
    getTotal,
    getItemCount,
    clearCart,
    buyNowItem,
    setBuyNowItem,
  } = useCartStore();

  const checkoutItems = buyNowItem ? [buyNowItem] : items;
  const checkoutItemCount = buyNowItem ? buyNowItem.quantity : getItemCount();
  const subtotal = buyNowItem
    ? buyNowItem.price * buyNowItem.quantity
    : getTotal();

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      email: "",
      phone: "",
      street: "",
      city: "",
      state: "",
      zipCode: "",
      deliveryNotes: "",
    },
  });

  const deliveryNotesValue = watch("deliveryNotes") || "";

  // Auth and Profile state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [storedProfile, setStoredProfile] = useState<UserData | null>(null);

  // Fetch user profile on mount — auto-fill ALL fields
  useEffect(() => {
    axios
      .get("/api/profile")
      .then((res) => {
        setIsAuthenticated(true);
        const { user } = res.data;
        if (user) {
          setStoredProfile(user);
          const address = user.shippingAddress || {};
          setValue("customerName", user.name || "");
          setValue("email", user.email || "");
          setValue("phone", user.phone || "");
          setValue("street", address.street || "");
          setValue("city", address.city || "");
          setValue("state", address.state || "");
          setValue("zipCode", address.zipCode || "");
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, [setValue]);

  // Detect if the user has changed any field from their stored profile values
  const currentValues = watch();
  const isChanged =
    !!storedProfile &&
    (currentValues.customerName !== (storedProfile.name || "") ||
      currentValues.email !== (storedProfile.email || "") ||
      currentValues.phone !== (storedProfile.phone || "") ||
      currentValues.street !== (storedProfile.shippingAddress?.street || "") ||
      currentValues.city !== (storedProfile.shippingAddress?.city || "") ||
      currentValues.state !== (storedProfile.shippingAddress?.state || "") ||
      currentValues.zipCode !== (storedProfile.shippingAddress?.zipCode || ""));

  // Coupon
  const [coupon, setCoupon] = useState({
    code: "",
    applied: false,
    discount: 0,
    loading: false,
    error: "",
  });

  // Mobile sticky
  const payBtnRef = useRef<HTMLButtonElement | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  const pricing = usePricingSettings();

  // Calculation
  const shippingFree = subtotal >= pricing.shippingThreshold;
  const shippingCost = shippingFree ? 0 : pricing.shippingCost;
  const discountedSubtotal = Math.max(subtotal - coupon.discount, 0);
  // GST disabled — no GST registration yet
  // const taxAmount = Math.round(
  //   (discountedSubtotal + shippingCost) * pricing.gstRate,
  // );
  const taxAmount = 0;
  const totalAmount = discountedSubtotal + shippingCost + taxAmount;

  // Mount animation
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Redirect if cart empty (unless success)
  useEffect(() => {
    if (isSuccess) return;
    // Read the cart as it is right now: on a fresh page load the saved cart is restored just
    // after the first render, so the value captured during that render can still be empty.
    const { items, buyNowItem } = useCartStore.getState();
    if (!buyNowItem && items.length === 0) {
      router.push("/cart");
    }
  }, [checkoutItems.length, isSuccess, router]);

  // Intersection observer for mobile sticky bar
  useEffect(() => {
    const btn = payBtnRef.current;
    if (!btn) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(btn);
    return () => observer.disconnect();
  }, [checkoutItems.length]);

  // ─── Coupon handlers ──────────────────────────────────────────────────

  const handleApplyCoupon = async () => {
    if (!coupon.code.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    setCoupon((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const res = await axios.post("/api/checkout/promo", {
        code: coupon.code.trim(),
        subtotal,
      });
      const data = res.data;
      setCoupon({
        code: data.code,
        applied: true,
        discount: data.discountAmount,
        loading: false,
        error: "",
      });
      toast.success(
        `Coupon applied! You save ${formatPrice(data.discountAmount)}`,
      );
    } catch (err) {
      const errorMessage = getApiErrorMessage(err, "Invalid coupon code");
      setCoupon((prev) => ({ ...prev, loading: false, error: errorMessage }));
    }
  };

  const handleRemoveCoupon = () => {
    setCoupon({
      code: "",
      applied: false,
      discount: 0,
      loading: false,
      error: "",
    });
    toast.success("Coupon removed");
  };

  const handleCouponCodeChange = (code: string) => {
    setCoupon((prev) => ({ ...prev, code, error: "" }));
  };

  // ─── Form submission + Razorpay ───────────────────────────────────────

  const onSubmit = async (data: CheckoutFormValues) => {
    setIsLoading(true);

    try {
      // Step 1: Create order on backend
      const { data: dataRes } = await axios.post("/api/checkout/create-order", {
        items: checkoutItems.map((item) => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          image: item.image,
          size: item.size,
          color: item.color,
        })),
        subtotal: subtotal,
        shippingCost,
        taxAmount,
        totalAmount,
        customerName: data.customerName.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        shippingAddress: {
          street: data.street.trim(),
          city: data.city.trim(),
          state: data.state.trim(),
          zipCode: data.zipCode.trim(),
          country: "India",
        },
        ...(data.deliveryNotes?.trim() && {
          deliveryNotes: data.deliveryNotes.trim(),
        }),
        saveAddress: data.saveAddress,
        ...(coupon.applied && {
          promoCode: coupon.code,
          discountAmount: coupon.discount,
        }),
      });

      // Step 2: Open Razorpay checkout
      const options = {
        key: dataRes.razorpayKeyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: dataRes.amount,
        currency: dataRes.currency,
        name: "Indian Mist",
        description: "Indian Mist order",
        order_id: dataRes.razorpayOrderId,
        prefill: {
          name: data.customerName.trim(),
          email: data.email.trim(),
          contact: data.phone.trim(),
        },
        theme: {
          color: "#283618",
          backdrop_color: "rgba(40, 54, 24, 0.75)",
        },
        handler: async (response: RazorpaySuccessResponse) => {
          try {
            // Step 3: Verify payment
            const { data: verifyRes } = await axios.post(
              "/api/checkout/verify-payment",
              {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
            );

            setOrderId(verifyRes.orderId);
            setIsSuccess(true);

            if (buyNowItem) {
              setBuyNowItem(null);
            } else {
              clearCart();
            }

            toast.success("Payment successful! Your order has been placed.");
          } catch (err) {
            toast.error("Payment verification failed. Please contact support.");
          }
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false);
            toast.error("Payment cancelled");
            // Put the held stock back on sale right away
            axios
              .post("/api/checkout/release", { razorpayOrderId: dataRes.razorpayOrderId })
              .catch(() => {});
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", (response) => {
        toast.error(
          response.error?.description || "Payment failed. Please try again.",
        );
        setIsLoading(false);
      });
      razorpay.open();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Something went wrong. Please try again."));
      setIsLoading(false);
    }
  };

  // ─── Conditional renders ──────────────────────────────────────────────

  if (isSuccess) {
    return <CheckoutSuccess orderId={orderId} />;
  }

  if (checkoutItems.length === 0) {
    return null; // Will redirect in useEffect
  }

  return (
    <>
      <div className="bg-cornsilk min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-6 pb-20">
          {/* Breadcrumb */}
          <Breadcrumb
            className="pb-2"
            items={[
              { label: "Home", href: "/" },
              { label: "Bag", href: "/cart" },
              { label: "Checkout" },
            ]}
          />

          {/* Page header */}
          <div className="flex items-center gap-3 mt-2 mb-6">
            <Link
              href="/cart"
              className="p-2 text-forest/75 hover:text-forest hover:bg-olive/10 rounded-sm transition-colors"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div>
              <h1 className="font-merriweather text-2xl md:text-3xl font-normal text-forest">
                Checkout
              </h1>
              <p className="font-montserrat text-xs text-muted-text font-normal">
                {checkoutItemCount} item{checkoutItemCount !== 1 ? "s" : ""} in
                your bag
              </p>
            </div>
          </div>

          {/* Step Progress */}
          <StepProgress currentStep={1} />

          {/* 2-column layout */}
          <form
            id="checkout-form"
            onSubmit={handleSubmit(onSubmit)}
            className={`grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {/* Left — Shipping Form */}
            <ShippingForm
              register={register}
              errors={errors}
              deliveryNotesLength={deliveryNotesValue.length}
              isAuthenticated={isAuthenticated}
              hasStoredAddress={!!storedProfile?.shippingAddress?.street}
              isChanged={isChanged}
            />

            {/* Right — Order Summary */}
            <CheckoutOrderSummary
              items={checkoutItems}
              subtotal={subtotal}
              shippingFree={shippingFree}
              shippingCost={shippingCost}
              discountedSubtotal={discountedSubtotal}
              taxAmount={taxAmount}
              totalAmount={totalAmount}
              coupon={coupon}
              onCouponCodeChange={handleCouponCodeChange}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={handleRemoveCoupon}
              isLoading={isLoading}
              payBtnRef={payBtnRef}
              gstRate={pricing.gstRate}
            />
          </form>
        </div>
      </div>

      {/* Mobile sticky pay bar */}
      {checkoutItems.length > 0 && showStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-cornsilk/95 backdrop-blur-md border-t border-olive/15 p-4 flex justify-between items-center lg:hidden shadow-[0_-4px_24px_rgba(40,54,24,0.08)]">
          <div>
            <p className="font-montserrat text-[10px] text-muted-text uppercase tracking-wider">
              Total
            </p>
            <p className="font-merriweather text-xl font-bold text-forest">
              {formatPrice(totalAmount)}
            </p>
          </div>
          <button
            type="submit"
            form="checkout-form"
            disabled={isLoading}
            className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-3.5 rounded-sm hover:bg-olive transition-colors min-h-11 flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Processing
              </>
            ) : (
              <>
                <LockKeyhole className="size-3.5" />
                Pay Now
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
