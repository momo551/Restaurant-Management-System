import { create } from 'zustand';
import { publicApi } from '../api/publicApi';

export const useOfferStore = create((set, get) => ({
    offers: {},          // keyed by product (menu_item) id
    rawOffers: [],       // full list for featured offer on home page
    loaded: false,
    restaurantSlug: null,

    fetchOffers: async (restaurantSlug) => {
        if (get().restaurantSlug === restaurantSlug && get().loaded) return;
        set({ offers: {}, rawOffers: [], loaded: false, restaurantSlug });
        try {
            const res = await publicApi.getOffers(restaurantSlug);
            const raw = Array.isArray(res.data) ? res.data : [];
            const map = {};
            raw.forEach(offer => {
                map[offer.product] = offer;
            });
            if (get().restaurantSlug === restaurantSlug) {
                set({ offers: map, rawOffers: raw, loaded: true });
            }
        } catch (err) {
            console.error('Failed to fetch offers:', err);
        }
    },

    getOfferForItem: (itemId) => {
        return get().offers[itemId] || null;
    },

    getFeaturedOffer: () => {
        const raw = get().rawOffers;
        return raw.length > 0 ? raw[0] : null;
    },
}));
