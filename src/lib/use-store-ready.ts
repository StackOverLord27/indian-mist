"use client";

import { useEffect, useState } from "react";

type Persisted = { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void } };

/** True once a persisted (localStorage) store has loaded, so a page can show a skeleton instead of a false "empty" state before that. */
export function useStoreReady(store: Persisted): boolean {
  const [ready, setReady] = useState(() => store.persist.hasHydrated());
  useEffect(() => {
    if (store.persist.hasHydrated()) setReady(true);
    return store.persist.onFinishHydration(() => setReady(true));
  }, [store]);
  return ready;
}
