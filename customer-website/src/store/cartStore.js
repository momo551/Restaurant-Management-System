import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(
    persist(
        (set, get) => ({
            items: [],
            orderMethod: 'delivery', // default

            setOrderMethod: (method) => set({ orderMethod: method }),

            addItem: (menuItem) => set((state) => {
                const existing = state.items.find(i => i.id === menuItem.id);
                if (existing) {
                    return {
                        items: state.items.map(i =>
                            i.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i
                        )
                    };
                }
                return { items: [...state.items, { ...menuItem, quantity: 1 }] };
            }),

            removeItem: (itemId) => set((state) => ({
                items: state.items.filter(i => i.id !== itemId)
            })),

            updateQuantity: (itemId, delta) => set((state) => ({
                items: state.items.map(i =>
                    i.id === itemId
                        ? { ...i, quantity: Math.max(1, i.quantity + delta) }
                        : i
                )
            })),

            clearCart: () => set({ items: [] }),

            getTotal: () => {
                return get().items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            },

            itemsCount: () => {
                return get().items.reduce((sum, item) => sum + item.quantity, 0);
            },

            getDeliveryFee: () => {
                const total = get().getTotal();
                if (total === 0) return 0;
                if (total < 500) return 25;
                if (total < 1000) return 28;
                if (total < 2000) return 33;
                if (total < 5000) return 48;
                if (total < 8000) return 98;
                return 259;
            }
        }),
        {
            name: 'restaurant-cart',
        }
    )
);
