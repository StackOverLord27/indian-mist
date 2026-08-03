import React from 'react';

export const inputClass = "w-full px-4 py-2.5 bg-cornsilk border border-olive/25 rounded-sm font-montserrat text-sm text-forest outline-none focus:border-olive transition-colors placeholder:text-forest/60/50";

interface AdminFormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export default function AdminFormField({ label, required, error, hint, children }: AdminFormFieldProps) {
  return (
    <div className="w-full">
      <label className="block font-montserrat text-xs font-semibold uppercase tracking-wider text-forest mb-1.5">
        {label} {required && <span className="text-copper">*</span>}
      </label>
      {children}
      {error && <p className="font-montserrat text-xs text-copper mt-1">{error}</p>}
      {hint && !error && <p className="font-montserrat text-xs text-forest/60 mt-1">{hint}</p>}
    </div>
  );
}
