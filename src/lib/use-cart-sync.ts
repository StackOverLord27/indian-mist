"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useCartStore } from "@/lib/cart-store";

/** Checks the bag against the server once it has loaded, and tells the shopper what changed. */
export function useCartSync() {
  const [hydrated, setHydrated] = useState(() => useCartStore.persist.hasHydrated());

  useEffect(() => {
    if (useCartStore.persist.hasHydrated()) setHydrated(true);
    return useCartStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const { items, buyNowItem } = useCartStore.getState();
    const lines = [...items, ...(buyNowItem ? [buyNowItem] : [])];
    if (lines.length === 0) return;

    let cancelled = false;
    axios
      .post("/api/products/cart", {
        items: lines.map((i) => ({ productId: i.id, size: i.size })),
      })
      .then(({ data }) => {
        if (cancelled) return;
        const notes = useCartStore.getState().applyServerCheck(data.results);
        if (notes.length) toast(notes.join("\n"), { duration: 6000 });
      })
      .catch(() => {
        /* offline or server busy: keep the bag as it is, payment re-checks everything */
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated]);
}
