"use client";

import AdminProtectedRoute from "@/components/admin/AdminProtectedRoute";
import {
  useSiteSettings,
  useUpdateSettings,
} from "@/hooks/admin/useSiteSettings";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminFormField, {
  inputClass,
} from "@/components/admin/ui/AdminFormField";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteSettings, HeroSettings, BrandStorySettings } from "@/types/admin";
import ImageUploadZone from "@/components/admin/ui/ImageUploadZone";
import { adminAxios } from "@/lib/admin-axios";
import toast from "react-hot-toast";
import { AVAILABLE_ICONS } from "@/lib/icon-map";

const defaultHeroSettings: HeroSettings = {
  ecoBadge: { text: "Certified Organic", subtext: "GOTS", isVisible: true },
};

const defaultTrustItems = [
  { icon: "Truck", title: "Free shipping", subtitle: "Above ₹999" },
  { icon: "Leaf", title: "1 tree per order", subtitle: "Planted with care" },
  {
    icon: "Recycle",
    title: "Sustainable materials",
    subtitle: "Low-impact goods",
  },
  { icon: "ShieldCheck", title: "Easy returns", subtitle: "Simple exchanges" },
  { icon: "Award", title: "Ethically sourced", subtitle: "Traceable makers" },
];

const defaultEcoItems = [
  {
    icon: "TreePine",
    number: "12k+",
    label: "Trees planted",
    description: "Native saplings funded through every order.",
  },
  {
    icon: "Recycle",
    number: "100%",
    label: "Recycled packaging",
    description: "Mailers, tags, and inserts made to be reused.",
  },
  {
    icon: "PackageCheck",
    number: "0",
    label: "Plastic used",
    description: "Plastic-free shipping across our core catalog.",
  },
  {
    icon: "HandHeart",
    number: "1%",
    label: "Revenue donated",
    description: "Annual giving toward rewilding and maker welfare.",
  },
];

const defaultEcoSettings = {
  subtitle: "Our commitment",
  titleLine1: "Every order shapes a gentler ",
  titleLine2: "future.",
  items: defaultEcoItems,
};

export default function AdminHomepageContentPage() {
  const { data, isLoading } = useSiteSettings();
  const updateMutation = useUpdateSettings();
  const [isUploading, setIsUploading] = useState(false);

  const [settings, setSettings] = useState<SiteSettings>({
    heroSettings: defaultHeroSettings,
    brandStorySettings: {
      subtitle: "OUR ROOTS",
      titleLine1: "We make things the forest would ",
      titleLine2: "keep.",
      description:
        "Indian Mist began with the simple belief that useful goods should leave less behind. Every pack, tee, pin, and page starts with better materials, durable making, and a supply chain we can explain.",
      tags: "Organic cotton, Natural dyes, Zero plastic, Fair trade",
      buttonText: "Read our story",
      buttonLink: "/about",
      imageUrl: "",
    },
    trustStripSettings: { items: defaultTrustItems },
    ecoCommitmentSettings: defaultEcoSettings,
  });

  useEffect(() => {
    if (data) {
      setSettings((prev) => ({
        ...prev,
        ...data,
        heroSettings: {
          ...defaultHeroSettings,
          ...(data.heroSettings || {}),
          ecoBadge: {
            ...defaultHeroSettings.ecoBadge,
            ...(data.heroSettings?.ecoBadge || {}),
            text:
              data.heroSettings?.ecoBadge?.text ??
              defaultHeroSettings.ecoBadge?.text ??
              "",
            subtext:
              data.heroSettings?.ecoBadge?.subtext ??
              defaultHeroSettings.ecoBadge?.subtext ??
              "",
            isVisible:
              data.heroSettings?.ecoBadge?.isVisible ??
              defaultHeroSettings.ecoBadge?.isVisible ??
              true,
          },
        },
        brandStorySettings: {
          subtitle: data.brandStorySettings?.subtitle ?? "OUR ROOTS",
          titleLine1:
            data.brandStorySettings?.titleLine1 ??
            "We make things the forest would ",
          titleLine2: data.brandStorySettings?.titleLine2 ?? "keep.",
          description:
            data.brandStorySettings?.description ??
            "Indian Mist began with the simple belief that useful goods should leave less behind. Every pack, tee, pin, and page starts with better materials, durable making, and a supply chain we can explain.",
          tags:
            data.brandStorySettings?.tags ??
            "Organic cotton, Natural dyes, Zero plastic, Fair trade",
          buttonText: data.brandStorySettings?.buttonText ?? "Read our story",
          buttonLink: data.brandStorySettings?.buttonLink ?? "/about",
          imageUrl: data.brandStorySettings?.imageUrl ?? "",
        },
        trustStripSettings: {
          items: data.trustStripSettings?.items?.length
            ? data.trustStripSettings.items
            : defaultTrustItems,
        },
        ecoCommitmentSettings: {
          subtitle:
            data.ecoCommitmentSettings?.subtitle ?? defaultEcoSettings.subtitle,
          titleLine1:
            data.ecoCommitmentSettings?.titleLine1 ??
            defaultEcoSettings.titleLine1,
          titleLine2:
            data.ecoCommitmentSettings?.titleLine2 ??
            defaultEcoSettings.titleLine2,
          items: data.ecoCommitmentSettings?.items?.length
            ? data.ecoCommitmentSettings.items
            : defaultEcoItems,
        },
      }));
    }
  }, [data]);

  const hero = settings.heroSettings || defaultHeroSettings;
  const eco = hero.ecoBadge || defaultHeroSettings.ecoBadge || {};
  const brandStory = settings.brandStorySettings || {};
  const trustStrip = settings.trustStripSettings || {
    items: defaultTrustItems,
  };
  const ecoSettings = settings.ecoCommitmentSettings || defaultEcoSettings;

  const handleHeroChange = (field: keyof HeroSettings, value: HeroSettings[keyof HeroSettings]) => {
    setSettings((prev) => ({
      ...prev,
      heroSettings: {
        ...(prev.heroSettings || defaultHeroSettings),
        [field]: value,
      },
    }));
  };

  const handleEcoBadgeChange = (
    field: "text" | "subtext" | "isVisible",
    value: string | boolean,
  ) => {
    setSettings((prev) => {
      const currentHero = prev.heroSettings || defaultHeroSettings;
      const currentBadge =
        currentHero.ecoBadge || defaultHeroSettings.ecoBadge || {};
      return {
        ...prev,
        heroSettings: {
          ...currentHero,
          ecoBadge: {
            ...currentBadge,
            [field]: value,
          },
        },
      };
    });
  };

  const handleBrandStoryChange = (
    field: keyof BrandStorySettings,
    value: BrandStorySettings[keyof BrandStorySettings],
  ) => {
    setSettings((prev) => ({
      ...prev,
      brandStorySettings: {
        ...(prev.brandStorySettings || {}),
        [field]: value,
      },
    }));
  };

  const handleTrustItemChange = (
    index: number,
    field: string,
    value: string,
  ) => {
    setSettings((prev) => {
      const newItems = [
        ...(prev.trustStripSettings?.items || defaultTrustItems),
      ];
      newItems[index] = { ...newItems[index], [field]: value };
      return {
        ...prev,
        trustStripSettings: { items: newItems },
      };
    });
  };

  const handleAddTrustItem = () => {
    setSettings((prev) => {
      const newItems = [
        ...(prev.trustStripSettings?.items || defaultTrustItems),
      ];
      newItems.push({
        icon: "Leaf",
        title: "New Feature",
        subtitle: "Feature details",
      });
      return { ...prev, trustStripSettings: { items: newItems } };
    });
  };

  const handleRemoveTrustItem = (index: number) => {
    setSettings((prev) => {
      const newItems = [
        ...(prev.trustStripSettings?.items || defaultTrustItems),
      ];
      newItems.splice(index, 1);
      return { ...prev, trustStripSettings: { items: newItems } };
    });
  };

  const handleEcoSettingChange = (field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      ecoCommitmentSettings: {
        ...(prev.ecoCommitmentSettings || defaultEcoSettings),
        [field]: value,
      },
    }));
  };

  const handleEcoItemChange = (index: number, field: string, value: string) => {
    setSettings((prev) => {
      const newItems = [
        ...(prev.ecoCommitmentSettings?.items || defaultEcoItems),
      ];
      newItems[index] = { ...newItems[index], [field]: value };
      return {
        ...prev,
        ecoCommitmentSettings: {
          ...(prev.ecoCommitmentSettings || defaultEcoSettings),
          items: newItems,
        },
      };
    });
  };

  const handleAddEcoItem = () => {
    setSettings((prev) => {
      const newItems = [
        ...(prev.ecoCommitmentSettings?.items || defaultEcoItems),
      ];
      newItems.push({
        icon: "TreePine",
        number: "0",
        label: "New Metric",
        description: "Metric description",
      });
      return {
        ...prev,
        ecoCommitmentSettings: {
          ...(prev.ecoCommitmentSettings || defaultEcoSettings),
          items: newItems,
        },
      };
    });
  };

  const handleRemoveEcoItem = (index: number) => {
    setSettings((prev) => {
      const newItems = [
        ...(prev.ecoCommitmentSettings?.items || defaultEcoItems),
      ];
      newItems.splice(index, 1);
      return {
        ...prev,
        ecoCommitmentSettings: {
          ...(prev.ecoCommitmentSettings || defaultEcoSettings),
          items: newItems,
        },
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(settings);
  };

  if (isLoading)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-olive size-8" />
      </div>
    );

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">
        Homepage Content
      </h1>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <AdminCard title="Hero Section Settings">
          <div className="space-y-4">
            <AdminFormField label="Small Subtitle / Collection Tag">
              <input
                value={hero.subtitle ?? ""}
                onChange={(e) => handleHeroChange("subtitle", e.target.value)}
                className={inputClass}
                placeholder="e.g. Summer 2026 Collection"
              />
            </AdminFormField>

            <AdminFormField label="Theme">
              <div className="grid grid-cols-3 gap-3 mt-1">
                {(
                  [
                    {
                      value: "forest",
                      label: "Forest",
                      desc: "Dark green",
                      bg: "#283618",
                      accent: "#dda15e",
                      text: "#fefae0",
                    },
                    {
                      value: "midnight",
                      label: "Midnight",
                      desc: "Charcoal",
                      bg: "#1c1917",
                      accent: "#fbbf24",
                      text: "#fafaf9",
                    },
                    {
                      value: "sunlit",
                      label: "Sunlit",
                      desc: "Terracotta",
                      bg: "#bc6c25",
                      accent: "#fefae0",
                      text: "#fefae0",
                    },
                  ] as const
                ).map((theme) => {
                  const isSelected = (hero.theme ?? "forest") === theme.value;
                  return (
                    <button
                      key={theme.value}
                      type="button"
                      onClick={() => handleHeroChange("theme", theme.value)}
                      className={`relative flex flex-col overflow-hidden rounded border-2 transition-all ${
                        isSelected
                          ? "border-olive shadow-md scale-[1.02]"
                          : "border-olive/20 hover:border-olive/50"
                      }`}
                    >
                      {/* Color preview swatch */}
                      <div
                        className="h-14 w-full flex items-center justify-center gap-1.5 px-2"
                        style={{ backgroundColor: theme.bg }}
                      >
                        <span
                          className="font-serif text-sm font-light"
                          style={{ color: theme.text }}
                        >
                          Aa
                        </span>
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: theme.accent }}
                        />
                      </div>
                      {/* Label row */}
                      <div className="bg-white px-2 py-1.5 text-left">
                        <p className="font-sans text-xs font-semibold text-forest leading-none">
                          {theme.label}
                        </p>
                        <p className="font-sans text-2xs text-forest/50 mt-0.5">
                          {theme.desc}
                        </p>
                      </div>
                      {/* Selected checkmark */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 size-4 rounded-full bg-olive flex items-center justify-center">
                          <svg
                            className="size-2.5 text-cornsilk"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </AdminFormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminFormField label="Heading Line 1">
                <input
                  value={hero.titleLine1 ?? ""}
                  onChange={(e) =>
                    handleHeroChange("titleLine1", e.target.value)
                  }
                  className={inputClass}
                  placeholder="e.g. Born from the forest,"
                />
              </AdminFormField>
              <AdminFormField label="Heading Line 2 (Accent / Italic)">
                <input
                  value={hero.titleLine2 ?? ""}
                  onChange={(e) =>
                    handleHeroChange("titleLine2", e.target.value)
                  }
                  className={inputClass}
                  placeholder="e.g. made for the wild."
                />
              </AdminFormField>
            </div>

            <AdminFormField label="Description">
              <textarea
                value={hero.description ?? ""}
                onChange={(e) =>
                  handleHeroChange("description", e.target.value)
                }
                className={`${inputClass} resize-none h-24`}
                placeholder="Short introductory description"
              />
            </AdminFormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminFormField label="Primary Button Text">
                <input
                  value={hero.primaryButtonText ?? ""}
                  onChange={(e) =>
                    handleHeroChange("primaryButtonText", e.target.value)
                  }
                  className={inputClass}
                  placeholder="Shop the collection →"
                />
              </AdminFormField>
              <AdminFormField label="Primary Button Link">
                <input
                  value={hero.primaryButtonLink ?? ""}
                  onChange={(e) =>
                    handleHeroChange("primaryButtonLink", e.target.value)
                  }
                  className={inputClass}
                  placeholder="/products"
                />
              </AdminFormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminFormField label="Secondary Button Text">
                <input
                  value={hero.secondaryButtonText ?? ""}
                  onChange={(e) =>
                    handleHeroChange("secondaryButtonText", e.target.value)
                  }
                  className={inputClass}
                  placeholder="Our story"
                />
              </AdminFormField>
              <AdminFormField label="Secondary Button Link">
                <input
                  value={hero.secondaryButtonLink ?? ""}
                  onChange={(e) =>
                    handleHeroChange("secondaryButtonLink", e.target.value)
                  }
                  className={inputClass}
                  placeholder="/about"
                />
              </AdminFormField>
            </div>

            <div className="p-4 bg-warm border border-olive/15 rounded-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-sans text-sm font-medium text-forest">
                    Eco Material Overlay Badge
                  </h4>
                  <p className="font-sans text-xs text-forest/60">
                    Floating badge shown on the corner of the carousel image.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-sans text-xs text-forest/70 font-medium">
                    {eco.isVisible ? "Visible" : "Hidden"}
                  </span>
                  <Switch
                    checked={eco.isVisible ?? true}
                    onCheckedChange={(checked) =>
                      handleEcoBadgeChange("isVisible", Boolean(checked))
                    }
                  />
                </div>
              </div>

              {(eco.isVisible ?? true) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-olive/10">
                  <AdminFormField label="Badge Stat / Percentage">
                    <input
                      value={eco.text ?? ""}
                      onChange={(e) =>
                        handleEcoBadgeChange("text", e.target.value)
                      }
                      className={inputClass}
                      placeholder="e.g. 100%"
                    />
                  </AdminFormField>
                  <AdminFormField label="Badge Subtitle">
                    <input
                      value={eco.subtext ?? ""}
                      onChange={(e) =>
                        handleEcoBadgeChange("subtext", e.target.value)
                      }
                      className={inputClass}
                      placeholder="e.g. Eco materials"
                    />
                  </AdminFormField>
                </div>
              )}
            </div>
          </div>
        </AdminCard>

        <AdminCard title="Brand Story Section">
          <div className="space-y-4">
            <AdminFormField label="Subtitle">
              <input
                value={brandStory.subtitle ?? ""}
                onChange={(e) =>
                  handleBrandStoryChange("subtitle", e.target.value)
                }
                className={inputClass}
                placeholder="e.g. OUR ROOTS"
              />
            </AdminFormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminFormField label="Heading Line 1">
                <input
                  value={brandStory.titleLine1 ?? ""}
                  onChange={(e) =>
                    handleBrandStoryChange("titleLine1", e.target.value)
                  }
                  className={inputClass}
                />
              </AdminFormField>
              <AdminFormField label="Heading Line 2 (Accent / Italic)">
                <input
                  value={brandStory.titleLine2 ?? ""}
                  onChange={(e) =>
                    handleBrandStoryChange("titleLine2", e.target.value)
                  }
                  className={inputClass}
                />
              </AdminFormField>
            </div>
            <AdminFormField label="Description">
              <textarea
                value={brandStory.description ?? ""}
                onChange={(e) =>
                  handleBrandStoryChange("description", e.target.value)
                }
                className={`${inputClass} resize-none h-24`}
              />
            </AdminFormField>
            <AdminFormField label="Tags (comma separated)">
              <input
                value={brandStory.tags ?? ""}
                onChange={(e) => handleBrandStoryChange("tags", e.target.value)}
                className={inputClass}
                placeholder="e.g. Organic cotton, Natural dyes"
              />
            </AdminFormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminFormField label="Button Text">
                <input
                  value={brandStory.buttonText ?? ""}
                  onChange={(e) =>
                    handleBrandStoryChange("buttonText", e.target.value)
                  }
                  className={inputClass}
                />
              </AdminFormField>
              <AdminFormField label="Button Link">
                <input
                  value={brandStory.buttonLink ?? ""}
                  onChange={(e) =>
                    handleBrandStoryChange("buttonLink", e.target.value)
                  }
                  className={inputClass}
                />
              </AdminFormField>
            </div>
            <AdminFormField label="Background Image">
              <div className="space-y-2">
                <ImageUploadZone
                  hint="Recommended: 1800 × 1200 px (3:2). Keep the subject in the centre; phones show it square and large monitors very wide."
                  multiple={false}
                  maxFiles={1}
                  currentImages={
                    brandStory.imageUrl
                      ? [
                          {
                            url: brandStory.imageUrl,
                            publicId: brandStory.imageUrl,
                            isPrimary: true,
                          },
                        ]
                      : []
                  }
                  onRemoveExisting={() =>
                    handleBrandStoryChange("imageUrl", "")
                  }
                  onFilesSelected={async (files) => {
                    if (files.length === 0) return;
                    setIsUploading(true);
                    try {
                      const formData = new FormData();
                      formData.append("file", files[0]);
                      formData.append("context", "brand-story");
                      const { data } = await adminAxios.post(
                        "/api/admin/upload",
                        formData,
                        {
                          headers: { "Content-Type": "multipart/form-data" },
                        },
                      );
                      handleBrandStoryChange("imageUrl", data.url);
                      toast.success("Image uploaded successfully");
                    } catch (error) {
                      toast.error("Failed to upload image");
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                />
                <p className="font-montserrat text-xs text-forest/60">
                  Current URL: {brandStory.imageUrl || "None"}
                </p>
              </div>
            </AdminFormField>
          </div>
        </AdminCard>

        <AdminCard title="Trust Strip Settings">
          <div className="space-y-6">
            {trustStrip.items.map((item, index) => (
              <div
                key={index}
                className="flex flex-col md:flex-row gap-4 items-end p-4 border border-olive/10 bg-white/50 rounded-sm"
              >
                <AdminFormField label="Icon Name (Lucide)">
                  <select
                    value={item.icon}
                    onChange={(e) =>
                      handleTrustItemChange(index, "icon", e.target.value)
                    }
                    className={inputClass}
                  >
                    {AVAILABLE_ICONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </AdminFormField>
                <AdminFormField label="Title">
                  <input
                    value={item.title}
                    onChange={(e) =>
                      handleTrustItemChange(index, "title", e.target.value)
                    }
                    className={inputClass}
                  />
                </AdminFormField>
                <AdminFormField label="Subtitle">
                  <input
                    value={item.subtitle}
                    onChange={(e) =>
                      handleTrustItemChange(index, "subtitle", e.target.value)
                    }
                    className={inputClass}
                  />
                </AdminFormField>
                <button
                  type="button"
                  onClick={() => handleRemoveTrustItem(index)}
                  className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 text-sm rounded-sm transition-colors md:h-[42px]"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddTrustItem}
              className="w-full bg-olive/10 text-forest hover:bg-olive/20 px-4 py-3 text-sm rounded-sm transition-colors border border-olive/20 border-dashed font-medium"
            >
              + Add Trust Strip Item
            </button>
          </div>
        </AdminCard>

        <AdminCard title="Eco Commitment Settings">
          <div className="space-y-6">
            <div className="space-y-4">
              <AdminFormField label="Subtitle">
                <input
                  value={ecoSettings.subtitle}
                  onChange={(e) =>
                    handleEcoSettingChange("subtitle", e.target.value)
                  }
                  className={inputClass}
                />
              </AdminFormField>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AdminFormField label="Heading Line 1">
                  <input
                    value={ecoSettings.titleLine1}
                    onChange={(e) =>
                      handleEcoSettingChange("titleLine1", e.target.value)
                    }
                    className={inputClass}
                  />
                </AdminFormField>
                <AdminFormField label="Heading Line 2 (Accent / Italic)">
                  <input
                    value={ecoSettings.titleLine2}
                    onChange={(e) =>
                      handleEcoSettingChange("titleLine2", e.target.value)
                    }
                    className={inputClass}
                  />
                </AdminFormField>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-olive/10">
              <h4 className="font-sans text-sm font-medium text-forest">
                Stats Items
              </h4>
              {ecoSettings.items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-4 p-4 border border-olive/10 bg-white/50 rounded-sm"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <AdminFormField label="Icon Name (Lucide)">
                      <select
                        value={item.icon}
                        onChange={(e) =>
                          handleEcoItemChange(index, "icon", e.target.value)
                        }
                        className={inputClass}
                      >
                        {AVAILABLE_ICONS.map((icon) => (
                          <option key={icon} value={icon}>
                            {icon}
                          </option>
                        ))}
                      </select>
                    </AdminFormField>
                    <AdminFormField label="Number/Stat">
                      <input
                        value={item.number}
                        onChange={(e) =>
                          handleEcoItemChange(index, "number", e.target.value)
                        }
                        className={inputClass}
                        placeholder="e.g. 12k+"
                      />
                    </AdminFormField>
                    <AdminFormField label="Label">
                      <input
                        value={item.label}
                        onChange={(e) =>
                          handleEcoItemChange(index, "label", e.target.value)
                        }
                        className={inputClass}
                      />
                    </AdminFormField>
                  </div>
                  <AdminFormField label="Description">
                    <input
                      value={item.description}
                      onChange={(e) =>
                        handleEcoItemChange(
                          index,
                          "description",
                          e.target.value,
                        )
                      }
                      className={inputClass}
                    />
                  </AdminFormField>
                  <button
                    type="button"
                    onClick={() => handleRemoveEcoItem(index)}
                    className="self-end bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 text-sm rounded-sm transition-colors md:h-[42px]"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddEcoItem}
                className="w-full bg-olive/10 text-forest hover:bg-olive/20 px-4 py-3 text-sm rounded-sm transition-colors border border-olive/20 border-dashed font-medium"
              >
                + Add Stat Item
              </button>
            </div>
          </div>
        </AdminCard>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending || isUploading}
            className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-8 py-3 rounded-sm hover:bg-olive transition-colors flex items-center justify-center min-w-[150px]"
          >
            {updateMutation.isPending || isUploading ? (
              <Loader2 className="animate-spin size-4" />
            ) : (
              "Save Settings"
            )}
          </button>
        </div>
      </form>
    </AdminProtectedRoute>
  );
}
