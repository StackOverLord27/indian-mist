"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ProfileHeader } from "./ProfileHeader";
import { AccountDetailsForm } from "./AccountDetailsForm";
import { DeliveryAddressForm } from "./DeliveryAddressForm";
import { OrderHistory } from "./OrderHistory";
import { ProfileSkeleton } from "./ProfileSkeleton";
import { LoadFailure } from "./LoadFailure";
import { useCustomerProfile } from "@/hooks/useCustomerProfile";
import { failureMessage } from "@/lib/customer-session";

export function ProfilePageClient() {
  const router = useRouter();
  const { state, retry, setUser } = useCustomerProfile();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // A 401 that survived a renewal: the session really is over (cart and bag stay in the browser)
  useEffect(() => {
    if (state.status === "signed-out") router.replace("/signin?callbackUrl=/profile");
  }, [state.status, router]);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    router.push("/");
  }

  if (state.status === "loading" || state.status === "signed-out") return <ProfileSkeleton />;

  if (state.status === "error") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-cornsilk px-4">
        <LoadFailure
          title="We couldn't load your profile"
          message={failureMessage(state.failure)}
          onRetry={retry}
        />
      </div>
    );
  }

  const { user, orders } = state;

  return (
    <div className="bg-cornsilk min-h-screen">
      <div className="max-w-page mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-6 pb-20">
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
