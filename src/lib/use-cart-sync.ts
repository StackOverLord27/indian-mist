"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useCartStore } from "@/lib/cart-store";
import { customerApi, classifyFailure, failureMessage, type Failure } from "@/lib/customer-session";

export type CartSyncState = { status: "idle" | "checking" } | { status: "failed"; failure: Failure };

/**
 * Checks the bag against the server once it has loaded, and tells the shopper what changed.
 * The bag itself is always shown from the browser; this only reports its own progress: "checking"
 * (a slow call ends after the customer-session deadline) and "failed" with a retry, so a slow or
 * broken check never looks like a hang. A failed check never changes the bag.
 */
export function useCartSync() {
  const [hydrated, setHydrated] = useState(() => useCartStore.persist.hasHydrated());
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CartSyncState>({ status: "idle" });

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
    customerApi
      .post("/api/products/cart", {
        items: lines.map((i) => ({ productId: i.id, size: i.size })),
      })
      .then(({ data }) => {
        if (cancelled) return;
        setState({ status: "idle" });
        const notes = useCartStore.getState().applyServerCheck(data.results);
        if (notes.length) toast(notes.join("\n"), { duration: 6000 });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Keep the bag as it is: payment re-checks everything on the server
        setState({ status: "failed", failure: classifyFailure(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, attempt]);

  const retry = useCallback(() => {
    setState({ status: "checking" });
    setAttempt((n) => n + 1);
  }, []);

  return {
    state,
    retry,
    /** Short text for a notice under the bag, or null when there is nothing to say */
    failureText: state.status === "failed" ? failureMessage(state.failure) : null,
  };
}
