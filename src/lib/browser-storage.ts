import type { StateStorage } from "zustand/middleware";

const readLegacyCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
};

const clearLegacyCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;Secure;SameSite=Strict`;
};

/**
 * Storage for the bag and the wishlist. They used to live in cookies, which browsers cap at
 * about 4 KB: a longer list silently stopped saving. localStorage has room for them. Anything
 * still saved in the old cookie is picked up once and moved over.
 */
export const browserStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(name);
      if (stored !== null) return stored;
    } catch {
      /* storage blocked: fall through to the old cookie */
    }
    const legacy = readLegacyCookie(name);
    if (legacy !== null) {
      try {
        window.localStorage.setItem(name, legacy);
        clearLegacyCookie(name);
      } catch {
        /* keep the cookie if it cannot be moved */
      }
    }
    return legacy;
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* storage full or blocked: the cart still works for this visit */
    }
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
    clearLegacyCookie(name);
  },
};
