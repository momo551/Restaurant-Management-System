import { create } from 'zustand';
import { publicApi } from '../api/publicApi';

export const useCampaignStore = create((set, get) => ({
    campaign: null,
    restaurantSlug: null,
    loading: false,
    fetchCampaign: async (restaurantSlug) => {
        // Cache only within the URL-authoritative restaurant context.
        if (get().restaurantSlug === restaurantSlug && (get().campaign || get().loading)) return;
        
        set({ loading: true, campaign: null, restaurantSlug });
        try {
            const res = await publicApi.getActiveCampaign(restaurantSlug);
            if (get().restaurantSlug === restaurantSlug) set({ campaign: res.data, loading: false });
        } catch (error) {
            console.error("Failed to fetch campaign", error);
            if (get().restaurantSlug === restaurantSlug) set({ loading: false });
        }
    },
    getMultiplier: () => {
        const campaign = get().campaign;
        return campaign ? parseFloat(campaign.multiplier) : 1.0;
    }
}));
