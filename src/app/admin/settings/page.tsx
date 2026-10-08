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
      gstRate: 0, // GST disabled — no registration yet
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

        <div className="flex justify-end">
          <button 
            type="submit" 
            disabled={updateMutation.isPending}
            className="bg-forest text-cornsilk font-montserrat text-xs font-semibold uppercase tracking-wider px-8 py-3 rounded-sm hover:bg-olive transition-colors flex items-center justify-center min-w-37.5"
          >
            {updateMutation.isPending ? <Loader2 className="animate-spin size-4" /> : 'Save Settings'}
          </button>
        </div>
      </form>
    </AdminProtectedRoute>
  );
}
