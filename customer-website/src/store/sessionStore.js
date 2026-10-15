import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSessionStore = create(
    persist(
        (set, get) => ({
            tableInfo: null,
            sessionToken: null,
            customerInfo: null,

            setTableInfo: (info) => set({ tableInfo: info }),
            setSessionToken: (token) => set({ sessionToken: token }),
            setCustomerInfo: (info) => set({ customerInfo: info }),

            clearSession: () => set({
                tableInfo: null,
                sessionToken: null,
                customerInfo: null
            }),

            isQRMode: () => !!get().tableInfo && !!get().sessionToken
        }),
        {
            name: 'restaurant-session',
        }
    )
);
