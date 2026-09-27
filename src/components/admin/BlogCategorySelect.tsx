"use client";

import { useState } from "react";
import { Plus, Loader2, X, Check } from "lucide-react";
import {
  useBlogCategories,
  useCreateBlogCategory,
} from "@/hooks/admin/useAdminBlogs";

const DEFAULT_CATEGORIES = [
  "Trail Stories",
  "Gear Guides",
  "Sustainability",
  "Brand Updates",
  "Tips & Tricks",
];

interface BlogCategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export default function BlogCategorySelect({
  value,
  onChange,
  required = true,
}: BlogCategorySelectProps) {
  const { data: categoryList } = useBlogCategories();
  const createCategoryMutation = useCreateBlogCategory();

  const [isAdding, setIsAdding] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Merge loaded categories with defaults, keeping current selected value if present
  const categories = (() => {
    const list =
      categoryList && categoryList.length > 0
        ? categoryList
        : DEFAULT_CATEGORIES;
    if (value && !list.includes(value)) {
      return [value, ...list];
    }
    return list;
  })();

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    createCategoryMutation.mutate(trimmed, {
      onSuccess: (data) => {
        onChange(data.category);
        setNewCatName("");
        setIsAdding(false);
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full font-montserrat text-sm text-forest bg-cornsilk border border-olive/20 rounded-sm p-2.5 focus:border-olive focus:ring-1 focus:ring-olive outline-none transition-colors cursor-pointer"
        >
          <option value="">Select a category...</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Create New Category Action */}
      {!isAdding ? (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-1.5 font-montserrat text-xs text-olive hover:text-forest transition-colors font-medium hover:underline decoration-olive/30"
        >
          <Plus className="size-3.5" />
          Create New Category
        </button>
      ) : (
        <div className="p-3 bg-warm/50 border border-olive/20 rounded-sm space-y-2 animate-in fade-in-50 duration-150">
          <label className="block font-montserrat text-[10px] uppercase tracking-wider text-forest/70 font-semibold">
            New Category Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                } else if (e.key === "Escape") {
                  setIsAdding(false);
                  setNewCatName("");
                }
              }}
              placeholder="e.g. Wildlife Conservation"
              className="flex-1 font-montserrat text-xs text-forest bg-white/70 border border-olive/20 rounded-sm px-3 py-1.5 focus:border-olive focus:ring-1 focus:ring-olive outline-none placeholder:text-forest/30"
            />
            <button
              type="button"
              onClick={() => handleCreate()}
              disabled={
                createCategoryMutation.isPending || !newCatName.trim()
              }
              className="bg-forest text-cornsilk font-montserrat text-xs font-semibold px-3 py-1.5 rounded-sm hover:bg-olive transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-xs"
            >
              {createCategoryMutation.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <>
                  <Check className="size-3" />
                  Save
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewCatName("");
              }}
              className="text-muted-text hover:text-forest p-1.5 transition-colors rounded-sm hover:bg-olive/10"
              title="Cancel"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="font-montserrat text-[9px] text-muted-text">
            Press Enter to save. The category will be saved and automatically selected.
          </p>
        </div>
      )}
    </div>
  );
}
