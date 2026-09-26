import { useState, useEffect } from 'react';
import { SHIPPING_COST, SHIPPING_THRESHOLD, GST_RATE } from '@/lib/constants';

interface PricingSettings {
  shippingCost: number;
  shippingThreshold: number;
  /** GST as a decimal fraction, e.g. 0.18 */
  gstRate: number;
  showPricesInclusiveOfGst: boolean;
}

async function fetchPricingSettings(): Promise<PricingSettings> {
  const res = await fetch('/api/settings');
  if (!res.ok) throw new Error('Failed to fetch settings');
  const { settings } = await res.json();
  const p = settings?.pricingSettings;
  return {
    shippingCost: p?.shippingCost ?? SHIPPING_COST,
    shippingThreshold: p?.freeShippingThreshold ?? SHIPPING_THRESHOLD,
    // gstRate stored as percentage (e.g. 18) — convert to decimal for calculations
    gstRate: p?.gstRate != null ? p.gstRate / 100 : GST_RATE,
    showPricesInclusiveOfGst: p?.showPricesInclusiveOfGst ?? false,
  };
}

/**
 * Returns live pricing settings fetched from the DB.
 * Falls back to compile-time constants until the fetch resolves.
 */
export function usePricingSettings() {
  const [settings, setSettings] = useState<PricingSettings>({
    shippingCost: SHIPPING_COST,
    shippingThreshold: SHIPPING_THRESHOLD,
    gstRate: GST_RATE,
    showPricesInclusiveOfGst: false,
  });

  useEffect(() => {
    let mounted = true;
    fetchPricingSettings()
      .then((data) => {
        if (mounted) setSettings(data);
      })
      .catch((err) => {
        console.error('Failed to load pricing settings', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return settings;
}
