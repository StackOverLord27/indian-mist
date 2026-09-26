import Link from "next/link";
import { CheckCircle2, Truck, Package } from "lucide-react";

interface CheckoutSuccessProps {
  orderId: string | null;
}

export function CheckoutSuccess({ orderId }: CheckoutSuccessProps) {
  return (
    <div className="bg-cornsilk min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center py-20 animate-[fadeInUp_0.6s_ease-out]">
        {/* Animated success ring */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full bg-olive/10 animate-ping" />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-olive/20 to-olive/5 flex items-center justify-center border-2 border-olive/20">
            <CheckCircle2 className="size-12 text-olive" />
          </div>
        </div>

        <h1 className="font-merriweather text-3xl md:text-4xl text-forest mb-3">
          Order Placed!
        </h1>
        <p className="font-montserrat text-sm text-muted-text mb-2">
          Thank you for your purchase. Your order has been confirmed.
        </p>
        {orderId && (
          <div className="inline-flex items-center gap-2 bg-olive/5 border border-olive/15 rounded-md px-4 py-2 mt-2 mb-8">
            <Package className="size-3.5 text-olive" />
            <span className="font-montserrat text-xs text-muted-text">
              Order ID:
            </span>
            <span className="font-montserrat text-xs text-forest font-semibold">
              {orderId}
            </span>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {/* Delivery estimate */}
          <div className="bg-card border border-olive/10 rounded-md p-4">
            <div className="flex items-center gap-3">
              <Truck className="size-5 text-olive" />
              <div className="text-left">
                <p className="font-montserrat text-xs font-semibold text-forest">
                  Estimated Delivery
                </p>
                <p className="font-montserrat text-sm text-muted-text">
                  5–7 business days
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <Link
              href="/"
              className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-3.5 rounded-sm hover:bg-olive transition-colors"
            >
              Continue Shopping
            </Link>
            <Link
              href="/profile"
              className="border border-olive/20 text-forest font-montserrat text-xs font-semibold uppercase tracking-wider px-6 py-3.5 rounded-sm hover:bg-olive/5 transition-colors"
            >
              View Orders
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
