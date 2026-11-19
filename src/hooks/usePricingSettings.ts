import { useState, useEffect } from 'react';
import type { ShippingRules } from '@/lib/order-totals';

/**
 * Not ready (still loading, or the request failed): there are NO numbers. Screens must show a
 * neutral state, never a guess. The compile-time constants are deliberately not used here.
 */
export type PricingSettings =
  | { ready: false }
  | ({
      ready: true;
      /** GST as a decimal fraction, e.g. 0.18 (GST is switched off in totals) */
      gstRate: number;
      showPricesInclusiveOfGst: boolean;
    } & ShippingRules);

async function fetchPricingSettings(): Promise<PricingSettings> {
  const res = await fetch('/api/settings', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch settings');
  const { settings, shippingRules } = await res.json();
  const rules = shippingRules as Partial<ShippingRules> | undefined;
  if (typeof rules?.shippingCost !== 'number' || typeof rules?.freeShippingThreshold !== 'number') {
    throw new Error('Settings response has no shipping rules');
  }
  const p = settings?.pricingSettings;
  return {
    ready: true,
    // exactly what the server will charge (see GET /api/settings)
    shippingCost: rules.shippingCost,
    freeShippingThreshold: rules.freeShippingThreshold,
    // gstRate is stored as a percentage (e.g. 18)
    gstRate: p?.gstRate != null ? p.gstRate / 100 : 0,
    showPricesInclusiveOfGst: p?.showPricesInclusiveOfGst ?? false,
  };
}

/** The live shipping rules from the server. Until they arrive (or if they cannot be loaded) `ready` is false. */
export function usePricingSettings(): PricingSettings {
  const [settings, setSettings] = useState<PricingSettings>({ ready: false });

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
