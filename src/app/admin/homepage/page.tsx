'use client';

import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { useSiteSettings, useUpdateSettings } from '@/hooks/admin/useSiteSettings';
import AdminCard from '@/components/admin/ui/AdminCard';
import AdminFormField, { inputClass } from '@/components/admin/ui/AdminFormField';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SiteSettings, HeroSettings, BrandStorySettings } from '@/types/admin';

const defaultHeroSettings: HeroSettings = {
  ecoBadge: { text: 'Certified Organic', subtext: 'GOTS', isVisible: true }
};

const defaultTrustItems = [
  { icon: 'Truck', title: 'Free shipping', subtitle: 'Above ₹999' },
  { icon: 'Leaf', title: '1 tree per order', subtitle: 'Planted with care' },
  { icon: 'Recycle', title: 'Sustainable materials', subtitle: 'Low-impact goods' },
  { icon: 'ShieldCheck', title: 'Easy returns', subtitle: 'Simple exchanges' },
  { icon: 'Award', title: 'Ethically sourced', subtitle: 'Traceable makers' }
];

const defaultEcoItems = [
  { icon: 'TreePine', number: '12k+', label: 'Trees planted', description: 'Native saplings funded through every order.' },
  { icon: 'Recycle', number: '100%', label: 'Recycled packaging', description: 'Mailers, tags, and inserts made to be reused.' },
  { icon: 'PackageCheck', number: '0', label: 'Plastic used', description: 'Plastic-free shipping across our core catalog.' },
  { icon: 'HandHeart', number: '1%', label: 'Revenue donated', description: 'Annual giving toward rewilding and maker welfare.' }
];

const defaultEcoSettings = {
  subtitle: 'Our commitment',
  titleLine1: 'Every order shapes a gentler ',
  titleLine2: 'future.',
  items: defaultEcoItems,
};

export default function AdminHomepageContentPage() {
  const { data, isLoading } = useSiteSettings();
  const updateMutation = useUpdateSettings();

  const [settings, setSettings] = useState<SiteSettings>({
    heroSettings: defaultHeroSettings,
    brandStorySettings: {
      subtitle: 'OUR ROOTS',
      titleLine1: 'We make things the forest would ',
      titleLine2: 'keep.',
      description: 'Indian Mist began with the simple belief that useful goods should leave less behind. Every pack, tee, pin, and page starts with better materials, durable making, and a supply chain we can explain.',
      tags: 'Organic cotton, Natural dyes, Zero plastic, Fair trade',
      buttonText: 'Read our story',
      buttonLink: '/about',
      imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2000&auto=format&fit=crop'
    },
    trustStripSettings: { items: defaultTrustItems },
    ecoCommitmentSettings: defaultEcoSettings,
  });

  useEffect(() => {
    if (data) {
      setSettings(prev => ({
        ...prev,
        ...data,
        heroSettings: {
          ...defaultHeroSettings,
          ...(data.heroSettings || {}),
          ecoBadge: {
            ...defaultHeroSettings.ecoBadge,
            ...(data.heroSettings?.ecoBadge || {}),
            text: data.heroSettings?.ecoBadge?.text ?? defaultHeroSettings.ecoBadge?.text ?? '',
            subtext: data.heroSettings?.ecoBadge?.subtext ?? defaultHeroSettings.ecoBadge?.subtext ?? '',
            isVisible: data.heroSettings?.ecoBadge?.isVisible ?? defaultHeroSettings.ecoBadge?.isVisible ?? true,
          },
        },
        brandStorySettings: {
          subtitle: data.brandStorySettings?.subtitle ?? 'OUR ROOTS',
          titleLine1: data.brandStorySettings?.titleLine1 ?? 'We make things the forest would ',
          titleLine2: data.brandStorySettings?.titleLine2 ?? 'keep.',
          description: data.brandStorySettings?.description ?? 'Indian Mist began with the simple belief that useful goods should leave less behind. Every pack, tee, pin, and page starts with better materials, durable making, and a supply chain we can explain.',
          tags: data.brandStorySettings?.tags ?? 'Organic cotton, Natural dyes, Zero plastic, Fair trade',
          buttonText: data.brandStorySettings?.buttonText ?? 'Read our story',
          buttonLink: data.brandStorySettings?.buttonLink ?? '/about',
          imageUrl: data.brandStorySettings?.imageUrl ?? 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2000&auto=format&fit=crop'
        },
        trustStripSettings: {
          items: data.trustStripSettings?.items?.length ? data.trustStripSettings.items : defaultTrustItems,
        },
        ecoCommitmentSettings: {
          subtitle: data.ecoCommitmentSettings?.subtitle ?? defaultEcoSettings.subtitle,
          titleLine1: data.ecoCommitmentSettings?.titleLine1 ?? defaultEcoSettings.titleLine1,
          titleLine2: data.ecoCommitmentSettings?.titleLine2 ?? defaultEcoSettings.titleLine2,
          items: data.ecoCommitmentSettings?.items?.length ? data.ecoCommitmentSettings.items : defaultEcoItems,
        },
      }));
    }
  }, [data]);

  const hero = settings.heroSettings || defaultHeroSettings;
  const eco = hero.ecoBadge || defaultHeroSettings.ecoBadge || {};
  const brandStory = settings.brandStorySettings || {};
  const trustStrip = settings.trustStripSettings || { items: defaultTrustItems };
  const ecoSettings = settings.ecoCommitmentSettings || defaultEcoSettings;

  const handleHeroChange = (field: keyof HeroSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      heroSettings: {
        ...(prev.heroSettings || defaultHeroSettings),
        [field]: value,
      },
    }));
  };

  const handleEcoBadgeChange = (field: 'text' | 'subtext' | 'isVisible', value: any) => {
    setSettings(prev => {
      const currentHero = prev.heroSettings || defaultHeroSettings;
      const currentBadge = currentHero.ecoBadge || defaultHeroSettings.ecoBadge || {};
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

  const handleBrandStoryChange = (field: keyof BrandStorySettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      brandStorySettings: {
        ...(prev.brandStorySettings || {}),
        [field]: value,
      },
    }));
  };

  const handleTrustItemChange = (index: number, field: string, value: string) => {
    setSettings(prev => {
      const newItems = [...(prev.trustStripSettings?.items || defaultTrustItems)];
      newItems[index] = { ...newItems[index], [field]: value };
      return {
        ...prev,
        trustStripSettings: { items: newItems },
      };
    });
  };

  const handleAddTrustItem = () => {
    setSettings(prev => {
      const newItems = [...(prev.trustStripSettings?.items || defaultTrustItems)];
      newItems.push({ icon: 'Leaf', title: 'New Feature', subtitle: 'Feature details' });
      return { ...prev, trustStripSettings: { items: newItems } };
    });
  };

  const handleRemoveTrustItem = (index: number) => {
    setSettings(prev => {
      const newItems = [...(prev.trustStripSettings?.items || defaultTrustItems)];
      newItems.splice(index, 1);
      return { ...prev, trustStripSettings: { items: newItems } };
    });
  };

  const handleEcoSettingChange = (field: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      ecoCommitmentSettings: {
        ...(prev.ecoCommitmentSettings || defaultEcoSettings),
        [field]: value,
      }
    }));
  };

  const handleEcoItemChange = (index: number, field: string, value: string) => {
    setSettings(prev => {
      const newItems = [...(prev.ecoCommitmentSettings?.items || defaultEcoItems)];
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
    setSettings(prev => {
      const newItems = [...(prev.ecoCommitmentSettings?.items || defaultEcoItems)];
      newItems.push({ icon: 'TreePine', number: '0', label: 'New Metric', description: 'Metric description' });
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
    setSettings(prev => {
      const newItems = [...(prev.ecoCommitmentSettings?.items || defaultEcoItems)];
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

  if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-olive size-8" /></div>;

  return (
    <AdminProtectedRoute>
      <h1 className="font-merriweather text-2xl text-forest mb-6">Homepage Content</h1>
      
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <AdminCard title="Hero Section Settings">
          <div className="space-y-4">
            <AdminFormField label="Small Subtitle / Collection Tag">
              <input 
                value={hero.subtitle ?? ''} 
                onChange={e => handleHeroChange('subtitle', e.target.value)} 
                className={inputClass} 
                placeholder="e.g. Summer 2026 Collection"
              />
            </AdminFormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminFormField label="Heading Line 1">
                <input 
                  value={hero.titleLine1 ?? ''} 
                  onChange={e => handleHeroChange('titleLine1', e.target.value)} 
                  className={inputClass} 
                  placeholder="e.g. Born from the forest,"
                />
              </AdminFormField>
              <AdminFormField label="Heading Line 2 (Accent / Italic)">
                <input 
                  value={hero.titleLine2 ?? ''} 
                  onChange={e => handleHeroChange('titleLine2', e.target.value)} 
                  className={inputClass} 
                  placeholder="e.g. made for the wild."
                />
              </AdminFormField>
            </div>

            <AdminFormField label="Description">
              <textarea 
                value={hero.description ?? ''} 
                onChange={e => handleHeroChange('description', e.target.value)} 
                className={`${inputClass} resize-none h-24`} 
                placeholder="Short introductory description"
              />
            </AdminFormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminFormField label="Primary Button Text">
                <input 
                  value={hero.primaryButtonText ?? ''} 
                  onChange={e => handleHeroChange('primaryButtonText', e.target.value)} 
                  className={inputClass} 
                  placeholder="Shop the collection →"
                />
              </AdminFormField>
              <AdminFormField label="Primary Button Link">
                <input 
                  value={hero.primaryButtonLink ?? ''} 
                  onChange={e => handleHeroChange('primaryButtonLink', e.target.value)} 
                  className={inputClass} 
                  placeholder="/products"
                />
              </AdminFormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminFormField label="Secondary Button Text">
                <input 
                  value={hero.secondaryButtonText ?? ''} 
                  onChange={e => handleHeroChange('secondaryButtonText', e.target.value)} 
                  className={inputClass} 
                  placeholder="Our story"
                />
              </AdminFormField>
              <AdminFormField label="Secondary Button Link">
                <input 
                  value={hero.secondaryButtonLink ?? ''} 
                  onChange={e => handleHeroChange('secondaryButtonLink', e.target.value)} 
                  className={inputClass} 
                  placeholder="/about"
                />
              </AdminFormField>
            </div>

            <div className="p-4 bg-warm border border-olive/15 rounded-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-sans text-sm font-medium text-forest">Eco Material Overlay Badge</h4>
                  <p className="font-sans text-xs text-forest/60">Floating badge shown on the corner of the carousel image.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-sans text-xs text-forest/70 font-medium">
                    {eco.isVisible ? 'Visible' : 'Hidden'}
                  </span>
                  <Switch 
                    checked={eco.isVisible ?? true} 
                    onCheckedChange={(checked) => handleEcoBadgeChange('isVisible', Boolean(checked))} 
                  />
                </div>
              </div>

              {(eco.isVisible ?? true) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-olive/10">
                  <AdminFormField label="Badge Stat / Percentage">
                    <input 
                      value={eco.text ?? ''} 
                      onChange={e => handleEcoBadgeChange('text', e.target.value)} 
                      className={inputClass} 
                      placeholder="e.g. 100%"
                    />
                  </AdminFormField>
                  <AdminFormField label="Badge Subtitle">
                    <input 
                      value={eco.subtext ?? ''} 
                      onChange={e => handleEcoBadgeChange('subtext', e.target.value)} 
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
                value={brandStory.subtitle ?? ''} 
                onChange={e => handleBrandStoryChange('subtitle', e.target.value)} 
                className={inputClass} 
                placeholder="e.g. OUR ROOTS"
              />
            </AdminFormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminFormField label="Heading Line 1">
                <input 
                  value={brandStory.titleLine1 ?? ''} 
                  onChange={e => handleBrandStoryChange('titleLine1', e.target.value)} 
                  className={inputClass} 
                />
              </AdminFormField>
              <AdminFormField label="Heading Line 2 (Accent / Italic)">
                <input 
                  value={brandStory.titleLine2 ?? ''} 
                  onChange={e => handleBrandStoryChange('titleLine2', e.target.value)} 
                  className={inputClass} 
                />
              </AdminFormField>
            </div>
            <AdminFormField label="Description">
              <textarea 
                value={brandStory.description ?? ''} 
                onChange={e => handleBrandStoryChange('description', e.target.value)} 
                className={`${inputClass} resize-none h-24`} 
              />
            </AdminFormField>
            <AdminFormField label="Tags (comma separated)">
              <input 
                value={brandStory.tags ?? ''} 
                onChange={e => handleBrandStoryChange('tags', e.target.value)} 
                className={inputClass} 
                placeholder="e.g. Organic cotton, Natural dyes"
              />
            </AdminFormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AdminFormField label="Button Text">
                <input value={brandStory.buttonText ?? ''} onChange={e => handleBrandStoryChange('buttonText', e.target.value)} className={inputClass} />
              </AdminFormField>
              <AdminFormField label="Button Link">
                <input value={brandStory.buttonLink ?? ''} onChange={e => handleBrandStoryChange('buttonLink', e.target.value)} className={inputClass} />
              </AdminFormField>
            </div>
            <AdminFormField label="Background Image URL">
              <input value={brandStory.imageUrl ?? ''} onChange={e => handleBrandStoryChange('imageUrl', e.target.value)} className={inputClass} />
            </AdminFormField>
          </div>
        </AdminCard>

        <AdminCard title="Trust Strip Settings">
          <div className="space-y-6">
            {trustStrip.items.map((item, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-4 items-end p-4 border border-olive/10 bg-white/50 rounded-sm">
                <AdminFormField label="Icon Name (Lucide)">
                  <input 
                    value={item.icon} 
                    onChange={e => handleTrustItemChange(index, 'icon', e.target.value)} 
                    className={inputClass} 
                    placeholder="e.g. Leaf, Truck"
                  />
                </AdminFormField>
                <AdminFormField label="Title">
                  <input 
                    value={item.title} 
                    onChange={e => handleTrustItemChange(index, 'title', e.target.value)} 
                    className={inputClass} 
                  />
                </AdminFormField>
                <AdminFormField label="Subtitle">
                  <input 
                    value={item.subtitle} 
                    onChange={e => handleTrustItemChange(index, 'subtitle', e.target.value)} 
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
                  onChange={e => handleEcoSettingChange('subtitle', e.target.value)} 
                  className={inputClass} 
                />
              </AdminFormField>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AdminFormField label="Heading Line 1">
                  <input 
                    value={ecoSettings.titleLine1} 
                    onChange={e => handleEcoSettingChange('titleLine1', e.target.value)} 
                    className={inputClass} 
                  />
                </AdminFormField>
                <AdminFormField label="Heading Line 2 (Accent / Italic)">
                  <input 
                    value={ecoSettings.titleLine2} 
                    onChange={e => handleEcoSettingChange('titleLine2', e.target.value)} 
                    className={inputClass} 
                  />
                </AdminFormField>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-olive/10">
              <h4 className="font-sans text-sm font-medium text-forest">Stats Items</h4>
              {ecoSettings.items.map((item, index) => (
                <div key={index} className="flex flex-col gap-4 p-4 border border-olive/10 bg-white/50 rounded-sm">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <AdminFormField label="Icon Name (Lucide)">
                      <input 
                        value={item.icon} 
                        onChange={e => handleEcoItemChange(index, 'icon', e.target.value)} 
                        className={inputClass} 
                        placeholder="e.g. TreePine, Recycle"
                      />
                    </AdminFormField>
                    <AdminFormField label="Number/Stat">
                      <input 
                        value={item.number} 
                        onChange={e => handleEcoItemChange(index, 'number', e.target.value)} 
                        className={inputClass} 
                        placeholder="e.g. 12k+"
                      />
                    </AdminFormField>
                    <AdminFormField label="Label">
                      <input 
                        value={item.label} 
                        onChange={e => handleEcoItemChange(index, 'label', e.target.value)} 
                        className={inputClass} 
                      />
                    </AdminFormField>
                  </div>
                  <AdminFormField label="Description">
                    <input 
                      value={item.description} 
                      onChange={e => handleEcoItemChange(index, 'description', e.target.value)} 
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
