import { adminAxios } from '../admin-axios';
import { SiteSettings } from '@/types/admin';

export const fetchSiteSettings = async () => {
  const { data } = await adminAxios.get<{ settings: SiteSettings }>('/api/admin/settings');
  return data.settings;
};

export const updateSiteSettings = async (settings: Partial<SiteSettings>) => {
  const { data } = await adminAxios.put<{ settings: SiteSettings }>('/api/admin/settings', settings);
  return data.settings;
};

/**
 * Which settings each admin page owns. A page sends ONLY its own sections, and the server
 * saves only the sections it receives, so saving one page can never overwrite another's.
 */
export const SETTINGS_SECTIONS = {
  general: ['tagline', 'contactEmail', 'footerNote', 'metaTitle', 'metaDescription', 'socialLinks'],
  homepage: ['heroSettings', 'brandStorySettings', 'trustStripSettings', 'ecoCommitmentSettings'],
  contact: ['contactPageSettings'],
  blogs: ['blogPageSettings'],
  pricing: ['pricingSettings'],
} as const satisfies Record<string, readonly (keyof SiteSettings)[]>;

export type SettingsSection = keyof typeof SETTINGS_SECTIONS;

/** The part of a page's settings state that is sent when that page saves. */
export function settingsForSection(settings: SiteSettings, section: SettingsSection): Partial<SiteSettings> {
  const out: Record<string, unknown> = {};
  for (const key of SETTINGS_SECTIONS[section]) {
    if (settings[key] !== undefined) out[key] = settings[key];
  }
  return out as Partial<SiteSettings>;
}
