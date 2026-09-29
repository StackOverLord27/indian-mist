"use client";
import { useState, useEffect } from "react";
import {
  useSiteSettings,
  useUpdateSettings,
} from "@/hooks/admin/useSiteSettings";
import toast from "react-hot-toast";
import {
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  Pencil,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Tag,
  Clock,
  Users,
  Hash,
} from "lucide-react";
import AdminProtectedRoute from "@/components/admin/AdminProtectedRoute";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminFormField from "@/components/admin/ui/AdminFormField";
import type { PromoCode } from "@/types/admin";

const inputClass =
  "w-full bg-warm/50 border border-olive/20 rounded-sm px-4 py-2.5 font-montserrat text-sm text-forest focus:outline-none focus:border-olive focus:ring-1 focus:ring-olive transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const smallInputClass =
  "w-full bg-warm/50 border border-olive/20 rounded-sm px-3 py-2 font-montserrat text-xs text-forest focus:outline-none focus:border-olive focus:ring-1 focus:ring-olive transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

// ─── Promo Code Editor (inline card) ──────────────────────────────────────────

function PromoCodeEditor({
  promo,
  index,
  onChange,
  onRemove,
  onToggleActive,
  isNew,
}: {
  promo: PromoCode;
  index: number;
  onChange: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  onToggleActive: (index: number) => void;
  isNew?: boolean;
}) {
  const [expanded, setExpanded] = useState(isNew ?? false);
  const isExpired = promo.expiresAt
    ? new Date(promo.expiresAt) < new Date()
    : false;

  return (
    <div
      className={`border rounded-md overflow-hidden transition-all duration-200 ${
        promo.isActive
          ? isExpired
            ? "border-amber-300 bg-amber-50/30"
            : "border-olive/20 bg-warm-mist"
          : "border-olive/10 bg-olive/3"
      }`}
    >
      {/* Summary row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-olive/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Status dot */}
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${
            !promo.isActive
              ? "bg-gray-400"
              : isExpired
                ? "bg-amber-500"
                : "bg-emerald-500"
          }`}
        />

        {/* Code */}
        <span
          className={`font-montserrat text-sm font-bold tracking-wider uppercase ${
            promo.isActive ? "text-forest" : "text-forest/40"
          }`}
        >
          {promo.code || "NEW CODE"}
        </span>

        {/* Badges */}
        <div className="flex items-center gap-1.5 ml-2">
          {promo.discountType === "PERCENTAGE" ? (
            <span
              className={`font-montserrat text-[10px] px-1.5 py-0.5 rounded-sm font-semibold ${
                promo.discountValue > 100
                  ? "bg-red-100 text-red-700"
                  : "bg-olive/10 text-olive"
              }`}
            >
              {promo.discountValue > 100
                ? `⚠️ ${promo.discountValue}% (exceeds 100%)`
                : `${promo.discountValue}% OFF`}
            </span>
          ) : (
            <span className="font-montserrat text-[10px] bg-olive/10 text-olive px-1.5 py-0.5 rounded-sm font-semibold">
              ₹{promo.discountValue} OFF
            </span>
          )}
          {!promo.isActive && (
            <span className="font-montserrat text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-sm font-semibold">
              DISABLED
            </span>
          )}
          {isExpired && promo.isActive && (
            <span className="font-montserrat text-[10px] bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded-sm font-semibold">
              EXPIRED
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Quick actions */}
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onToggleActive.bind(null, index)}
            className={`p-1.5 rounded-md transition-colors ${
              promo.isActive
                ? "text-emerald-600 hover:bg-emerald-50"
                : "text-gray-400 hover:bg-gray-100"
            }`}
            title={promo.isActive ? "Disable code" : "Enable code"}
          >
            {promo.isActive ? (
              <ToggleRight className="size-5" />
            ) : (
              <ToggleLeft className="size-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-olive hover:bg-olive/10 rounded-md transition-colors"
            title="Edit"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        {/* Expand chevron */}
        {expanded ? (
          <ChevronUp className="size-4 text-olive/50" />
        ) : (
          <ChevronDown className="size-4 text-olive/50" />
        )}
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-olive/10">
          {/* Row 1: Code, Type, Value, Min Order */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="font-montserrat text-[10px] uppercase tracking-widest text-olive-leaf font-bold block mb-1">
                Code
              </label>
              <input
                type="text"
                placeholder="e.g. SUMMER20"
                value={promo.code}
                onChange={(e) =>
                  onChange(index, "code", e.target.value.toUpperCase())
                }
                className={smallInputClass}
              />
            </div>
            <div>
              <label className="font-montserrat text-[10px] uppercase tracking-widest text-olive-leaf font-bold block mb-1">
                Discount Type
              </label>
              <select
                value={promo.discountType}
                onChange={(e) =>
                  onChange(index, "discountType", e.target.value)
                }
                className={smallInputClass}
              >
                <option value="FIXED">Fixed Amount (₹ off)</option>
                <option value="PERCENTAGE">Percentage (% off)</option>
              </select>
            </div>
            <div>
              <label className="font-montserrat text-[10px] uppercase tracking-widest text-olive-leaf font-bold block mb-1">
                {promo.discountType === "PERCENTAGE"
                  ? "Discount (%)"
                  : "Discount (₹)"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    promo.discountValue === 0
                      ? ""
                      : String(promo.discountValue)
                  }
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    onChange(
                      index,
                      "discountValue",
                      val === "" ? 0 : parseInt(val, 10),
                    );
                  }}
                  className={`${smallInputClass} pr-7`}
                  placeholder={
                    promo.discountType === "PERCENTAGE" ? "e.g. 15" : "e.g. 200"
                  }
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-montserrat text-xs text-forest/40 pointer-events-none">
                  {promo.discountType === "PERCENTAGE" ? "%" : "₹"}
                </span>
              </div>
              {promo.discountType === "PERCENTAGE" &&
                promo.discountValue > 100 && (
                  <p className="font-montserrat text-[9px] text-red-500 mt-1">
                    Percentage cannot exceed 100%
                  </p>
                )}
            </div>
            <div>
              <label className="font-montserrat text-[10px] uppercase tracking-widest text-olive-leaf font-bold block mb-1">
                Min. Order (₹)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={
                  !promo.minOrderValue ? "" : String(promo.minOrderValue)
                }
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  onChange(
                    index,
                    "minOrderValue",
                    val === "" ? 0 : parseInt(val, 10),
                  );
                }}
                className={smallInputClass}
                placeholder="0"
              />
            </div>
          </div>

          {/* Row 2: Max Uses, Max Per User, Expires */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="font-montserrat text-[10px] uppercase tracking-widest text-olive-leaf font-bold block mb-1">
                <span className="flex items-center gap-1">
                  <Hash className="size-3" /> Max Uses
                </span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={!promo.maxUses ? "" : String(promo.maxUses)}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  onChange(
                    index,
                    "maxUses",
                    val === "" ? 0 : parseInt(val, 10),
                  );
                }}
                className={smallInputClass}
                placeholder="0 (unlimited)"
              />
              <span className="font-montserrat text-[9px] text-olive/60 mt-0.5 block">
                0 = unlimited
              </span>
            </div>
            <div>
              <label className="font-montserrat text-[10px] uppercase tracking-widest text-olive-leaf font-bold block mb-1">
                <span className="flex items-center gap-1">
                  <Users className="size-3" /> Per User
                </span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={
                  promo.maxUsesPerUser === undefined ||
                  promo.maxUsesPerUser === null ||
                  promo.maxUsesPerUser === 0
                    ? ""
                    : String(promo.maxUsesPerUser)
                }
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  onChange(
                    index,
                    "maxUsesPerUser",
                    val === "" ? 0 : parseInt(val, 10),
                  );
                }}
                className={smallInputClass}
                placeholder="1"
              />
              <span className="font-montserrat text-[9px] text-olive/60 mt-0.5 block">
                0 = unlimited
              </span>
            </div>
            <div className="md:col-span-2">
              <label className="font-montserrat text-[10px] uppercase tracking-widest text-olive-leaf font-bold block mb-1">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> Expires At
                </span>
              </label>
              <input
                type="datetime-local"
                value={
                  promo.expiresAt
                    ? new Date(promo.expiresAt).toISOString().slice(0, 16)
                    : ""
                }
                onChange={(e) =>
                  onChange(
                    index,
                    "expiresAt",
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  )
                }
                className={smallInputClass}
              />
              <span className="font-montserrat text-[9px] text-olive/60 mt-0.5 block">
                Leave blank for no expiry
              </span>
            </div>
          </div>

          {/* Row 3: Description */}
          <div>
            <label className="font-montserrat text-[10px] uppercase tracking-widest text-olive-leaf font-bold block mb-1">
              Description (internal note)
            </label>
            <input
              type="text"
              value={promo.description ?? ""}
              onChange={(e) => onChange(index, "description", e.target.value)}
              className={smallInputClass}
              placeholder="e.g. Summer sale campaign, influencer code, etc."
            />
          </div>

          {promo.createdAt && (
            <p className="font-montserrat text-[9px] text-olive/40 mt-2">
              Created:{" "}
              {new Date(promo.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminPricingPage() {
  const { data, isLoading } = useSiteSettings();
  const updateMutation = useUpdateSettings();
  const [settings, setSettings] = useState<any>({});
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (data && !isInitialized) {
      setSettings(data);
      setIsInitialized(true);
    }
  }, [data, isInitialized]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate promo codes before submit
    const codes: PromoCode[] = settings.pricingSettings?.promoCodes || [];
    for (const p of codes) {
      if (!p.code || !p.code.trim()) {
        toast.error("All promo codes must have a valid code name");
        return;
      }
      if (p.discountType === "PERCENTAGE" && p.discountValue > 100) {
        toast.error(
          `Promo code "${p.code}": percentage discount cannot exceed 100%`,
        );
        return;
      }
    }

    updateMutation.mutate(settings);
  };

  const handlePricingChange = (field: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      pricingSettings: {
        ...(prev.pricingSettings || {}),
        [field]: value,
      },
    }));
  };

  const handleAddPromo = () => {
    setSettings((prev: any) => ({
      ...prev,
      pricingSettings: {
        ...(prev.pricingSettings || {}),
        promoCodes: [
          {
            code: "",
            discountType: "FIXED",
            discountValue: 0,
            isActive: true,
            minOrderValue: 0,
            maxUses: 0,
            maxUsesPerUser: 1,
            description: "",
            expiresAt: null,
            createdAt: new Date().toISOString(),
          },
          ...(prev.pricingSettings?.promoCodes || []),
        ],
      },
    }));
  };

  const handleRemovePromo = (index: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this promo code? This action cannot be undone.",
      )
    )
      return;
    setSettings((prev: any) => {
      const promos = [...(prev.pricingSettings?.promoCodes || [])];
      promos.splice(index, 1);
      return {
        ...prev,
        pricingSettings: {
          ...prev.pricingSettings,
          promoCodes: promos,
        },
      };
    });
  };

  const handlePromoChange = (index: number, field: string, value: any) => {
    setSettings((prev: any) => {
      const promos = [...(prev.pricingSettings?.promoCodes || [])];
      promos[index] = { ...promos[index], [field]: value };
      return {
        ...prev,
        pricingSettings: {
          ...prev.pricingSettings,
          promoCodes: promos,
        },
      };
    });
  };

  const handleToggleActive = (index: number) => {
    setSettings((prev: any) => {
      const promos = [...(prev.pricingSettings?.promoCodes || [])];
      promos[index] = { ...promos[index], isActive: !promos[index].isActive };
      return {
        ...prev,
        pricingSettings: {
          ...prev.pricingSettings,
          promoCodes: promos,
        },
      };
    });
  };

  if (isLoading)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-olive size-8" />
      </div>
    );

  const promoCodes: PromoCode[] = settings.pricingSettings?.promoCodes || [];

  // Separate active from inactive/expired codes
  const now = new Date();
  const activePromos = promoCodes.filter(
    (p) => p.isActive && !(p.expiresAt && new Date(p.expiresAt) < now),
  );
  const inactivePromos = promoCodes.filter(
    (p) => !p.isActive || (p.expiresAt && new Date(p.expiresAt) < now),
  );

  // We need the original index for edits (since activePromos / inactivePromos are filtered views)
  const getOriginalIndex = (promo: PromoCode) => promoCodes.indexOf(promo);

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">
        Pricing & Promos
      </h1>

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        <AdminCard
          title="Shipping & Tax Rates"
          description="Global configuration for shipping fees and taxes applied at checkout."
        >
          <div className="p-3 mb-4 rounded-sm bg-amber-50 border border-amber-200 flex gap-2 items-start">
            <AlertCircle className="size-3.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="font-sans text-xs text-amber-700">
              <strong>Per-product GST:</strong> Different HSN codes carry
              different GST slabs (5%, 12%, 18%, 28%). For now a single
              store-wide rate is applied at checkout display. Product-level
              rates should be handled on invoices — contact your CA for
              compliance.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <AdminFormField
              label="Shipping Fee (₹)"
              hint="Charged when order is below the free-shipping threshold"
            >
              <input
                type="text"
                inputMode="numeric"
                value={
                  settings.pricingSettings?.shippingCost === 0
                    ? ""
                    : String(settings.pricingSettings?.shippingCost ?? 99)
                }
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  handlePricingChange(
                    "shippingCost",
                    val === "" ? 0 : parseInt(val, 10),
                  );
                }}
                placeholder="99"
                className={inputClass}
              />
            </AdminFormField>
            <AdminFormField
              label="Free Shipping Threshold (₹)"
              hint="Orders above this amount qualify for free shipping"
            >
              <input
                type="text"
                inputMode="numeric"
                value={
                  settings.pricingSettings?.freeShippingThreshold === 0
                    ? ""
                    : String(
                        settings.pricingSettings?.freeShippingThreshold ?? 999,
                      )
                }
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  handlePricingChange(
                    "freeShippingThreshold",
                    val === "" ? 0 : parseInt(val, 10),
                  );
                }}
                placeholder="999"
                className={inputClass}
              />
            </AdminFormField>
            <AdminFormField
              label="GST Rate (%)"
              hint="Applied to (subtotal + shipping). Indian standard is 18% for most apparel."
            >
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    settings.pricingSettings?.gstRate === 0
                      ? ""
                      : String(settings.pricingSettings?.gstRate ?? 18)
                  }
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, "");
                    handlePricingChange(
                      "gstRate",
                      val === "" ? 0 : parseFloat(val) || 0,
                    );
                  }}
                  placeholder="18"
                  className={`${inputClass} pr-10`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-sans text-sm text-forest/50">
                  %
                </span>
              </div>
            </AdminFormField>
            <AdminFormField
              label="Price Display"
              hint="How prices are shown to customers"
            >
              <select
                value={
                  settings.pricingSettings?.showPricesInclusiveOfGst
                    ? "inclusive"
                    : "exclusive"
                }
                onChange={(e) =>
                  handlePricingChange(
                    "showPricesInclusiveOfGst",
                    e.target.value === "inclusive",
                  )
                }
                className={inputClass}
              >
                <option value="exclusive">
                  Exclusive of GST (GST shown at checkout)
                </option>
                <option value="inclusive">
                  Inclusive of GST (price includes tax)
                </option>
              </select>
            </AdminFormField>
          </div>
        </AdminCard>

        {/* ─── Active Promo Codes ─────────────────────────────────── */}
        <AdminCard
          title="Active Promo Codes"
          description="Currently active discount codes that customers can use at checkout."
        >
          <div className="space-y-2">
            {/* Add button at top */}
            <button
              type="button"
              onClick={handleAddPromo}
              className="flex items-center gap-2 font-montserrat text-xs uppercase tracking-widest font-semibold text-forest border border-olive/30 border-dashed px-6 py-3 w-full justify-center hover:bg-olive/5 transition-colors rounded-sm mb-3"
            >
              <Plus className="size-4" />
              Add New Promo Code
            </button>

            {activePromos.length === 0 && (
              <div className="text-center py-8">
                <Tag className="size-8 text-olive/30 mx-auto mb-2" />
                <p className="font-montserrat text-sm text-olive/50">
                  No active promo codes
                </p>
                <p className="font-montserrat text-xs text-olive/30 mt-1">
                  Click "Add New Promo Code" to create one
                </p>
              </div>
            )}

            {activePromos.map((promo) => {
              const origIndex = getOriginalIndex(promo);
              return (
                <PromoCodeEditor
                  key={promo._id ?? `active-${origIndex}`}
                  promo={promo}
                  index={origIndex}
                  onChange={handlePromoChange}
                  onRemove={handleRemovePromo}
                  onToggleActive={handleToggleActive}
                />
              );
            })}
          </div>
        </AdminCard>

        {/* ─── Inactive / Expired Promo Codes ────────────────────── */}
        {inactivePromos.length > 0 && (
          <AdminCard
            title="Inactive & Expired Codes"
            description="Previously used or disabled promo codes. Re-enable them or delete them."
          >
            <div className="space-y-2">
              {inactivePromos.map((promo) => {
                const origIndex = getOriginalIndex(promo);
                return (
                  <PromoCodeEditor
                    key={promo._id ?? `inactive-${origIndex}`}
                    promo={promo}
                    index={origIndex}
                    onChange={handlePromoChange}
                    onRemove={handleRemovePromo}
                    onToggleActive={handleToggleActive}
                  />
                );
              })}
            </div>
          </AdminCard>
        )}

        <div className="flex justify-end sticky bottom-6">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-8 py-3 rounded-sm hover:bg-olive transition-colors flex items-center justify-center min-w-37.5 shadow-lg shadow-forest/20"
          >
            {updateMutation.isPending ? (
              <Loader2 className="animate-spin size-4" />
            ) : (
              "Save Pricing & Promos"
            )}
          </button>
        </div>
      </form>
    </AdminProtectedRoute>
  );
}
