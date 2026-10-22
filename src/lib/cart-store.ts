import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { browserStorage } from "./browser-storage";
import { applyCartCheck, mergeDuplicates, type CartCheckResult } from "./cart-sync";
import { useWishlistStore } from "./wishlist-store";

export type CartItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  image: string;
  size?: string;
  color?: string;
  quantity: number;
  /** Units in stock when added (tracked products only); the server re-checks at checkout */
  maxQuantity?: number;
};

type CartStore = {
  items: CartItem[];
  buyNowItem: CartItem | null;
  setBuyNowItem: (item: CartItem | null) => void;
  addItem: (item: CartItem) => void;
  removeItem: (id: string, size?: string) => void;
  updateQuantity: (id: string, quantity: number, size?: string) => void;
  clearCart: () => void;
  /** Refreshes lines from the server's answer and returns messages about what changed */
  applyServerCheck: (results: CartCheckResult[]) => string[];
  getTotal: () => number;
  getItemCount: () => number;
};

/**
 * Unique key per cart line: product + size. Each colour is its own product, so the colour
 * is already part of the product id and must not be part of the key (otherwise the same
 * item could appear twice, e.g. in carts saved before colours existed).
 */
const itemKey = (id: string, size?: string) => `${id}::${size ?? ""}`;

const capQuantity = (item: CartItem, quantity: number) =>
  item.maxQuantity !== undefined ? Math.min(quantity, Math.max(item.maxQuantity, 1)) : quantity;

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      buyNowItem: null,
      
      setBuyNowItem: (item) => set({ buyNowItem: item }),

      addItem: (item) => {
        const key = itemKey(item.id, item.size);
        set((state) => {
          const existing = state.items.find((i) => itemKey(i.id, i.size) === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                itemKey(i.id, i.size) === key
                  ? {
                      ...i,
                      maxQuantity: item.maxQuantity ?? i.maxQuantity,
                      quantity: capQuantity(item, i.quantity + item.quantity),
                    }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: capQuantity(item, item.quantity) }] };
        });
      },

      removeItem: (id, size) => {
        const key = itemKey(id, size);
        set((state) => ({
          items: state.items.filter((i) => itemKey(i.id, i.size) !== key),
        }));
      },

      updateQuantity: (id, quantity, size) => {
        const key = itemKey(id, size);
        if (quantity <= 0) {
          get().removeItem(id, size);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            itemKey(i.id, i.size) === key ? { ...i, quantity: capQuantity(i, quantity) } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      applyServerCheck: (results) => {
        const { items, buyNowItem } = get();
        const cart = applyCartCheck(items, results);
        const buyNow = buyNowItem ? applyCartCheck([buyNowItem], results) : null;
        set({ items: cart.items, buyNowItem: buyNow ? (buyNow.items[0] ?? null) : null });
        // Out-of-stock items are not lost: they go to the wishlist (colour variants are separate products)
        for (const item of [...cart.outOfStock, ...(buyNow?.outOfStock ?? [])]) {
          useWishlistStore.getState().addItem({
            id: item.id,
            slug: item.slug,
            name: item.name,
            category: item.category,
            price: item.price,
            originalPrice: item.originalPrice,
            image: item.image,
            hasSizes: !!item.size,
          });
        }
        return [...cart.notes, ...(buyNow?.notes ?? [])];
      },

      getTotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      getItemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "indian-mist-cart",
      storage: createJSONStorage(() => browserStorage),
      // The one-off "buy now" item is not saved: it must not outlive the visit and hide the bag at checkout
      partialize: (state) => ({ items: state.items }) as CartStore,
      skipHydration: true,
      // Clean up duplicate lines in carts saved before this rule existed
      merge: (persisted, current) => {
        const saved = persisted as Partial<CartStore> | undefined;
        return { ...current, ...saved, items: mergeDuplicates(saved?.items ?? current.items) };
      },
    }
  )
);
