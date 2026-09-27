import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { cookieStorage } from "./cookie-storage";

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
};

type CartStore = {
  items: CartItem[];
  buyNowItem: CartItem | null;
  setBuyNowItem: (item: CartItem | null) => void;
  addItem: (item: CartItem) => void;
  removeItem: (id: string, size?: string, color?: string) => void;
  updateQuantity: (
    id: string,
    quantity: number,
    size?: string,
    color?: string
  ) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
};

/** Unique key per item: id + size + color variant combination */
const itemKey = (id: string, size?: string, color?: string) =>
  `${id}::${size ?? ""}::${color ?? ""}`;

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      buyNowItem: null,
      
      setBuyNowItem: (item) => set({ buyNowItem: item }),

      addItem: (item) => {
        const key = itemKey(item.id, item.size, item.color);
        set((state) => {
          const existing = state.items.find(
            (i) => itemKey(i.id, i.size, i.color) === key
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                itemKey(i.id, i.size, i.color) === key
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            };
          }
          return { items: [...state.items, item] };
        });
      },

      removeItem: (id, size, color) => {
        const key = itemKey(id, size, color);
        set((state) => ({
          items: state.items.filter(
            (i) => itemKey(i.id, i.size, i.color) !== key
          ),
        }));
      },

      updateQuantity: (id, quantity, size, color) => {
        const key = itemKey(id, size, color);
        if (quantity <= 0) {
          get().removeItem(id, size, color);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            itemKey(i.id, i.size, i.color) === key ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      getTotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      getItemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "indian-mist-cart",
      storage: createJSONStorage(() => cookieStorage),
      skipHydration: true,
    }
  )
);
