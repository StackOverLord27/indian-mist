"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import type { UserData, OrderData } from "./types";
import { ProfileHeader } from "./ProfileHeader";
import { AccountDetailsForm } from "./AccountDetailsForm";
import { DeliveryAddressForm } from "./DeliveryAddressForm";
import { OrderHistory } from "./OrderHistory";

export function ProfilePageClient() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/signin?callbackUrl=/profile");
            return;
          }
          throw new Error("Failed to load profile");
        }
        const data = await res.json();
        setUser(data.user);
        setOrders(data.orders ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-cornsilk">
        <div className="size-7 rounded-full border-2 border-olive-leaf/30 border-t-olive-leaf animate-spin" />
      </div>
    );
  }
  
  if (!user) return null;

  return (
    <div className="bg-cornsilk min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-6 pb-20">
        <Breadcrumb
          className="pb-2"
          items={[
            { label: "Home", href: "/" },
            { label: "My Profile" },
          ]}
        />

        <ProfileHeader user={user} onSignOut={handleSignOut} />

        {/* Alerts */}
        {error && (
          <div className="mb-6 flex items-start gap-3 border-l-2 border-red-500 bg-red-50 p-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
            <p className="font-montserrat text-xs text-red-800">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 flex items-start gap-3 border-l-2 border-olive-leaf bg-olive-leaf/10 p-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-olive-leaf" />
            <p className="font-montserrat text-xs text-black-forest">{success}</p>
          </div>
        )}

        {/* Two-column grid layout */}
        <div className="grid grid-cols-1 gap-0 border border-olive-leaf/15 lg:grid-cols-[280px_1fr]">
          {/* Left column (Sidebar) */}
          <div className="border-b border-olive-leaf/15 lg:border-b-0 lg:border-r">
            <AccountDetailsForm
              user={user}
              onUpdate={setUser}
              setGlobalError={setError}
              setGlobalSuccess={setSuccess}
            />
            <DeliveryAddressForm
              user={user}
              onUpdate={setUser}
              setGlobalError={setError}
              setGlobalSuccess={setSuccess}
            />
          </div>

          {/* Right column (Main content) */}
          <OrderHistory orders={orders} />
        </div>
      </div>
    </div>
  );
}
