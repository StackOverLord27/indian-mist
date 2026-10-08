import { useState, useEffect } from "react";
import { Pencil, X } from "lucide-react";
import type { UserData, ShippingAddress } from "./types";

const ADDRESS_FIELDS: { label: string; key: keyof ShippingAddress }[] = [
  { label: "Street", key: "street" },
  { label: "City", key: "city" },
  { label: "State", key: "state" },
  { label: "ZIP Code", key: "zipCode" },
  { label: "Country", key: "country" },
];

export function DeliveryAddressForm({
  user,
  onUpdate,
  setGlobalError,
  setGlobalSuccess,
}: {
  user: UserData;
  onUpdate: (user: UserData) => void;
  setGlobalError: (err: string | null) => void;
  setGlobalSuccess: (msg: string | null) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<ShippingAddress>({
    street: "", city: "", state: "", zipCode: "", country: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user.shippingAddress) {
      setForm(user.shippingAddress);
    }
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setGlobalError(null);
    setGlobalSuccess(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingAddress: form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save address");
      onUpdate(data.user);
      setIsEditing(false);
      setGlobalSuccess("Address updated successfully.");
      setTimeout(() => setGlobalSuccess(null), 3000);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="border-y border-olive-leaf/15 px-6 py-4">
        <div className="flex items-center justify-between">
          <p className="font-montserrat text-xs font-bold uppercase tracking-widest text-olive-leaf">
            Delivery Address
          </p>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 font-montserrat text-xs font-semibold uppercase tracking-widest text-olive-leaf hover:text-copperwood transition-colors"
            >
              <Pencil className="size-3.5" /> Edit
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="divide-y divide-olive-leaf/10">
          {ADDRESS_FIELDS.map(({ label, key }) => (
            <div key={key} className="px-6 py-3">
              <label className="block font-montserrat text-3xs font-semibold uppercase tracking-widest text-olive-leaf/80 mb-1">
                {label}
              </label>
              <input
                type="text"
                required
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-full bg-transparent font-montserrat text-sm text-black-forest outline-none placeholder:text-olive-leaf/30 border-b border-olive-leaf/25 pb-1 focus:border-olive-leaf transition-colors"
              />
            </div>
          ))}
          <div className="flex divide-x divide-olive-leaf/15">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-olive-leaf py-3.5 font-montserrat text-xs font-semibold uppercase tracking-widest text-cornsilk transition-colors hover:bg-black-forest disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setForm(user.shippingAddress ?? { street: "", city: "", state: "", zipCode: "", country: "" });
              }}
              className="flex items-center justify-center px-5 py-3.5 text-olive-leaf/70 transition-colors hover:bg-olive-leaf/10 hover:text-olive-leaf"
            >
              <X className="size-4" />
            </button>
          </div>
        </form>
      ) : user.shippingAddress?.street ? (
        <div className="grid grid-cols-1 divide-y divide-olive-leaf/10">
          {[
            { label: "Street",  val: user.shippingAddress.street },
            { label: "City",    val: user.shippingAddress.city },
            { label: "State",   val: user.shippingAddress.state },
            { label: "ZIP",     val: user.shippingAddress.zipCode },
            { label: "Country", val: user.shippingAddress.country },
          ].map(({ label, val }) => (
            <div key={label} className="px-6 py-3">
              <p className="font-montserrat text-3xs font-semibold uppercase tracking-widest text-olive-leaf/80 mb-0.5">{label}</p>
              <p className="font-montserrat text-sm font-medium text-black-forest">{val}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-6 py-8 text-center">
          <p className="font-montserrat text-xs text-olive-leaf/70 italic mb-3">No address saved.</p>
          <button
            onClick={() => setIsEditing(true)}
            className="font-montserrat text-xs uppercase tracking-widest text-olive-leaf hover:text-copperwood transition-colors underline underline-offset-4"
          >
            Add address
          </button>
        </div>
      )}
    </>
  );
}
