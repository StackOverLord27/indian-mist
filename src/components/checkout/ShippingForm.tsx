import { MapPin, StickyNote } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { CheckoutFormValues } from "@/schemas/checkout";

interface ShippingFormProps {
  register: UseFormRegister<CheckoutFormValues>;
  errors: FieldErrors<CheckoutFormValues>;
  deliveryNotesLength: number;
  isAuthenticated: boolean;
  hasStoredAddress: boolean;
  isChanged: boolean;
}

export function ShippingForm({
  register,
  errors,
  deliveryNotesLength,
  isAuthenticated,
  hasStoredAddress,
  isChanged,
}: ShippingFormProps) {
  return (
    <div className="space-y-6">
      {/* Contact & Shipping Details */}
      <div className="bg-card border border-olive/10 rounded-md p-5 md:p-6">
        <div className="flex items-center gap-2 mb-5">
          <MapPin className="size-4 text-olive" />
          <h2 className="font-merriweather text-lg font-normal text-forest">
            Shipping Details
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="checkout-name"
              className="block font-montserrat text-xs uppercase tracking-wider text-forest/75 font-semibold mb-1.5"
            >
              Full Name *
            </label>
            <input
              id="checkout-name"
              type="text"
              {...register("customerName")}
              placeholder="John Doe"
              className={`w-full font-montserrat text-sm text-forest bg-transparent border rounded-sm p-3 focus:ring-2 outline-none placeholder:text-forest/20 transition-all ${
                errors.customerName ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/10" : "border-olive/15 focus:border-olive focus:ring-olive/10"
              }`}
            />
            {errors.customerName && (
              <p className="text-red-500 text-xs font-montserrat mt-1">{errors.customerName.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="checkout-email"
              className="block font-montserrat text-xs uppercase tracking-wider text-forest/75 font-semibold mb-1.5"
            >
              Email *
            </label>
            <input
              id="checkout-email"
              type="email"
              {...register("email")}
              placeholder="you@example.com"
              className={`w-full font-montserrat text-sm text-forest bg-transparent border rounded-sm p-3 focus:ring-2 outline-none placeholder:text-forest/20 transition-all ${
                errors.email ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/10" : "border-olive/15 focus:border-olive focus:ring-olive/10"
              }`}
            />
            {errors.email && (
              <p className="text-red-500 text-xs font-montserrat mt-1">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="checkout-phone"
              className="block font-montserrat text-xs uppercase tracking-wider text-forest/75 font-semibold mb-1.5"
            >
              Phone *
            </label>
            <input
              id="checkout-phone"
              type="tel"
              {...register("phone")}
              placeholder="+91 98765 43210"
              className={`w-full font-montserrat text-sm text-forest bg-transparent border rounded-sm p-3 focus:ring-2 outline-none placeholder:text-forest/20 transition-all ${
                errors.phone ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/10" : "border-olive/15 focus:border-olive focus:ring-olive/10"
              }`}
            />
            {errors.phone && (
              <p className="text-red-500 text-xs font-montserrat mt-1">{errors.phone.message}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="checkout-street"
              className="block font-montserrat text-xs uppercase tracking-wider text-forest/75 font-semibold mb-1.5"
            >
              Street Address *
            </label>
            <input
              id="checkout-street"
              type="text"
              {...register("street")}
              placeholder="123 Main Street, Apt 4B"
              className={`w-full font-montserrat text-sm text-forest bg-transparent border rounded-sm p-3 focus:ring-2 outline-none placeholder:text-forest/20 transition-all ${
                errors.street ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/10" : "border-olive/15 focus:border-olive focus:ring-olive/10"
              }`}
            />
            {errors.street && (
              <p className="text-red-500 text-xs font-montserrat mt-1">{errors.street.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="checkout-city"
              className="block font-montserrat text-xs uppercase tracking-wider text-forest/75 font-semibold mb-1.5"
            >
              City *
            </label>
            <input
              id="checkout-city"
              type="text"
              {...register("city")}
              placeholder="Mumbai"
              className={`w-full font-montserrat text-sm text-forest bg-transparent border rounded-sm p-3 focus:ring-2 outline-none placeholder:text-forest/20 transition-all ${
                errors.city ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/10" : "border-olive/15 focus:border-olive focus:ring-olive/10"
              }`}
            />
            {errors.city && (
              <p className="text-red-500 text-xs font-montserrat mt-1">{errors.city.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="checkout-state"
              className="block font-montserrat text-xs uppercase tracking-wider text-forest/75 font-semibold mb-1.5"
            >
              State *
            </label>
            <input
              id="checkout-state"
              type="text"
              {...register("state")}
              placeholder="Maharashtra"
              className={`w-full font-montserrat text-sm text-forest bg-transparent border rounded-sm p-3 focus:ring-2 outline-none placeholder:text-forest/20 transition-all ${
                errors.state ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/10" : "border-olive/15 focus:border-olive focus:ring-olive/10"
              }`}
            />
            {errors.state && (
              <p className="text-red-500 text-xs font-montserrat mt-1">{errors.state.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="checkout-zip"
              className="block font-montserrat text-xs uppercase tracking-wider text-forest/75 font-semibold mb-1.5"
            >
              PIN Code *
            </label>
            <input
              id="checkout-zip"
              type="text"
              {...register("zipCode")}
              placeholder="400001"
              maxLength={6}
              className={`w-full font-montserrat text-sm text-forest bg-transparent border rounded-sm p-3 focus:ring-2 outline-none placeholder:text-forest/20 transition-all ${
                errors.zipCode ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/10" : "border-olive/15 focus:border-olive focus:ring-olive/10"
              }`}
            />
            {errors.zipCode && (
              <p className="text-red-500 text-xs font-montserrat mt-1">{errors.zipCode.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="checkout-country"
              className="block font-montserrat text-xs uppercase tracking-wider text-forest/75 font-semibold mb-1.5"
            >
              Country
            </label>
            <input
              id="checkout-country"
              type="text"
              value="India"
              disabled
              className="w-full font-montserrat text-sm text-muted-text bg-olive/5 border border-olive/10 rounded-sm p-3"
            />
          </div>
        </div>
      </div>

      {/* Delivery Notes */}
      <div className="bg-card border border-olive/10 rounded-md p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <StickyNote className="size-4 text-olive" />
          <h2 className="font-merriweather text-lg font-normal text-forest">
            Delivery Notes
          </h2>
          <span className="font-montserrat text-[10px] uppercase tracking-wider text-muted-text ml-1">
            Optional
          </span>
        </div>
        <textarea
          id="checkout-notes"
          {...register("deliveryNotes")}
          placeholder="Any special instructions for delivery? (e.g., Leave at the door, Ring bell twice)"
          rows={3}
          maxLength={300}
          className={`w-full font-montserrat text-sm text-forest bg-transparent border rounded-sm p-3 focus:ring-2 outline-none placeholder:text-forest/20 transition-all resize-none ${
            errors.deliveryNotes ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/10" : "border-olive/15 focus:border-olive focus:ring-olive/10"
          }`}
        />
        <div className="flex justify-between items-start mt-1">
          {errors.deliveryNotes ? (
            <p className="text-red-500 text-xs font-montserrat">{errors.deliveryNotes.message}</p>
          ) : <div/>}
          <p className="font-montserrat text-[10px] text-muted-text text-right">
            {deliveryNotesLength}/300
          </p>
        </div>
      </div>

      {isAuthenticated && (!hasStoredAddress || isChanged) && (
        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer group w-fit">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                {...register("saveAddress")}
                className="peer sr-only"
              />
              <div className="size-5 rounded border border-olive/30 bg-white peer-checked:bg-forest peer-checked:border-forest transition-colors flex items-center justify-center">
                <svg
                  className="size-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <span className="font-sans text-sm text-forest group-hover:text-forest/80 transition-colors">
              {hasStoredAddress ? "Update my stored info with these details" : "Save these details for future orders"}
            </span>
          </label>
        </div>
      )}

      {/* EstimatedDelivery disabled — delivery window is not yet calculated
          accurately and could make misleading claims. Re-enable once the
          shipping integration provides real ETA data. */}
    </div>
  );
}
