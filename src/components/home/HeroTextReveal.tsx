"use client";

import { useEffect, useState, type ReactNode } from "react";

export function HeroTextReveal({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) {
      setReady(true);
      return;
    }

    requestAnimationFrame(() => setReady(true));
  }, []);

  return <div className={ready ? "hero-stagger" : "hero-stagger-hidden"}>{children}</div>;
}
