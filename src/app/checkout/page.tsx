import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";
import { CheckoutPageClient } from "@/components/checkout/CheckoutPageClient";

export const metadata: Metadata = {
  title: "Checkout",
  robots: NOINDEX,
  description: "Complete your purchase securely with Indian Mist.",
};

export default function CheckoutPage() {
  return <CheckoutPageClient />;
}
