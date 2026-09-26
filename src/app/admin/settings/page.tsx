'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { useSiteSettings, useUpdateSettings } from '@/hooks/admin/useSiteSettings';
import AdminCard from '@/components/admin/ui/AdminCard';
import AdminFormField, { inputClass } from '@/components/admin/ui/AdminFormField';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SiteSettings } from '@/types/admin';

export default function AdminSettingsPage() {
  const { data, isLoading } = useSiteSettings();
  const updateMutation = useUpdateSettings();

  const [settings, setSettings] = useState<SiteSettings>({
    tagline: '',
    contactEmail: '',
    socialLinks: { instagram: '', facebook: '', twitter: '', youtube: '' },
    footerNote: '',
    metaTitle: '',
    metaDescription: '',
    pricingSettings: {
      shippingCost: 99,
      freeShippingThreshold: 999,
      gstRate: 18,
      showPricesInclusiveOfGst: false,
    },
  });

  useEffect(() => {
    if (data) {
      setSettings(data);
    }
  }, [data]);

  const brandStory = settings.brandStorySettings || {};

  const handleChange = (field: keyof SiteSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialChange = (network: keyof NonNullable<SiteSettings['socialLinks']>, value: string) => {
    setSettings(prev => ({
      ...prev,
      socialLinks: { ...(prev.socialLinks || {}), [network]: value }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(settings);
  };

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-olive size-8" /></div>;

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">Site Settings</h1>
      
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <AdminCard title="General Information">
          <div className="space-y-4">
            <AdminFormField label="Tagline">
              <input value={settings.tagline ?? ''} onChange={e => handleChange('tagline', e.target.value)} className={inputClass} />
            </AdminFormField>
            <AdminFormField label="Contact Email" required>
              <input type="email" value={settings.contactEmail ?? ''} onChange={e => handleChange('contactEmail', e.target.value)} className={inputClass} />
            </AdminFormField>
          </div>
        </AdminCard>

        <AdminCard title="SEO & Meta">
          <div className="space-y-4">
            <AdminFormField label="Meta Title">
              <input value={settings.metaTitle ?? ''} onChange={e => handleChange('metaTitle', e.target.value)} className={inputClass} />
            </AdminFormField>
            <AdminFormField label="Meta Description">
              <div className="relative">
                <textarea 
                  value={settings.metaDescription ?? ''} 
                  onChange={e => handleChange('metaDescription', e.target.value)} 
                  className={`${inputClass} resize-none h-24`} 
                  maxLength={160}
                />
                <span className="absolute right-3 bottom-3 text-[10px] font-montserrat text-forest/60">
                  {(settings.metaDescription ?? '').length}/160
                </span>
              </div>
            </AdminFormField>
          </div>
        </AdminCard>

        <AdminCard title="Social Links & Footer">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <AdminFormField label="Instagram URL">
              <input value={settings.socialLinks?.instagram ?? ''} onChange={e => handleSocialChange('instagram', e.target.value)} className={inputClass} />
            </AdminFormField>
            <AdminFormField label="Facebook URL">
              <input value={settings.socialLinks?.facebook ?? ''} onChange={e => handleSocialChange('facebook', e.target.value)} className={inputClass} />
            </AdminFormField>
            <AdminFormField label="Twitter / X URL">
              <input value={settings.socialLinks?.twitter ?? ''} onChange={e => handleSocialChange('twitter', e.target.value)} className={inputClass} />
            </AdminFormField>
            <AdminFormField label="YouTube URL">
              <input value={settings.socialLinks?.youtube ?? ''} onChange={e => handleSocialChange('youtube', e.target.value)} className={inputClass} />
            </AdminFormField>
          </div>
          <AdminFormField label="Footer Note">
            <textarea value={settings.footerNote ?? ''} onChange={e => handleChange('footerNote', e.target.value)} className={`${inputClass} h-20 resize-none`} />
          </AdminFormField>
        </AdminCard>

        <AdminCard
          title="Pricing & Shipping"
          description="Changes apply to all checkout sessions immediately after saving. Cart page will also reflect new free-shipping threshold."
        >
          <div className="p-3 mb-4 rounded-sm bg-amber-50 border border-amber-200 flex gap-2 items-start">
            <AlertCircle className="size-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="font-sans text-xs text-amber-700">
              <strong>Per-product GST:</strong> Different HSN codes carry different GST slabs (5%, 12%, 18%, 28%). For now a single store-wide rate is applied at checkout display. Product-level rates should be handled on invoices — contact your CA for compliance.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <AdminFormField
              label="Shipping Fee (₹)"
              hint="Charged when order is below the free-shipping threshold"
            >
              <input
                type="number"
                min={0}
                step={1}
                value={settings.pricingSettings?.shippingCost ?? 99}
                onChange={e => setSettings(prev => ({
                  ...prev,
                  pricingSettings: { ...prev.pricingSettings, shippingCost: Number(e.target.value) }
                }))}
                className={inputClass}
              />
            </AdminFormField>
            <AdminFormField
              label="Free Shipping Threshold (₹)"
              hint="Orders above this amount qualify for free shipping"
            >
              <input
                type="number"
                min={0}
                step={1}
                value={settings.pricingSettings?.freeShippingThreshold ?? 999}
                onChange={e => setSettings(prev => ({
                  ...prev,
                  pricingSettings: { ...prev.pricingSettings, freeShippingThreshold: Number(e.target.value) }
                }))}
                className={inputClass}
              />
            </AdminFormField>
            <AdminFormField
              label="GST Rate (%)"
              hint="Applied to (subtotal + shipping). Indian standard is 18% for most apparel."
            >
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={settings.pricingSettings?.gstRate ?? 18}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    pricingSettings: { ...prev.pricingSettings, gstRate: Number(e.target.value) }
                  }))}
                  className={`${inputClass} pr-10`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-sans text-sm text-forest/50">%</span>
              </div>
            </AdminFormField>
            <AdminFormField
              label="Price Display"
              hint="How prices are shown to customers"
            >
              <select
                value={settings.pricingSettings?.showPricesInclusiveOfGst ? 'inclusive' : 'exclusive'}
                onChange={e => setSettings(prev => ({
                  ...prev,
                  pricingSettings: { ...prev.pricingSettings, showPricesInclusiveOfGst: e.target.value === 'inclusive' }
                }))}
                className={inputClass}
              >
                <option value="exclusive">Exclusive of GST (GST shown at checkout)</option>
                <option value="inclusive">Inclusive of GST (price includes tax)</option>
              </select>
            </AdminFormField>
          </div>
        </AdminCard>

        <div className="flex justify-end">
          <button 
            type="submit" 
            disabled={updateMutation.isPending}
            className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-8 py-3 rounded-sm hover:bg-olive transition-colors flex items-center justify-center min-w-[150px]"
          >
            {updateMutation.isPending ? <Loader2 className="animate-spin size-4" /> : 'Save Settings'}
          </button>
        </div>
      </form>
    </AdminProtectedRoute>
  );
}
