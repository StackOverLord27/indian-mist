"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/cart-store";
import { useWishlistStore } from "@/lib/wishlist-store";

/**
 * StoreHydration
 *
 * Rehydrates Zustand persisted stores after the component mounts on the client.
 * Because both stores use `skipHydration: true`, they start with their default
 * (empty) state during SSR. This component triggers localStorage rehydration
 * in a useEffect (after hydration), preventing React hydration mismatches.
 *
 * Place this once in the root layout.
 */
export function StoreHydration() {
  useEffect(() => {
    useCartStore.persist.rehydrate();
    useWishlistStore.persist.rehydrate();
  }, []);

  return null;
}
