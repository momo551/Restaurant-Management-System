import { create } from 'zustand';
import { publicApi } from '../api/publicApi';

// Fallbacks mirror backend DEFAULT_CONTENT so the site renders sensibly even
// before a restaurant publishes its first website settings snapshot.
export const DEFAULT_WEBSITE_SETTINGS = {
    display_name: '',
    hero_title: 'طعم يأخذك لعالم آخر',
    hero_subtitle: 'استمتع بأشهى المأكولات المحضرة بكل حب واتقان. اطلب الآن واستلم طلبك في أسرع وقت.',
    hero_cta_text: 'تصفح المنيو',
    hero_secondary_text: 'تتبع طلبك',
    primary_color: '#e04a4a',
    secondary_color: '#f97316',
    background_color: '#ffffff',
    text_color: '#111827',
    phone: '',
    whatsapp: '',
    address: '',
    footer_text: '',
    show_testimonials: true,
    logo_url: '',
    hero_image_url: '',
};

const hexToRgb = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const shade = (hex, pct) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const t = Math.abs(pct) / 100;
    const out = rgb.map(v => pct >= 0 ? Math.round(v + (255 - v) * t) : Math.round(v * (1 - t)));
    return `#${out.map(v => v.toString(16).padStart(2, '0')).join('')}`;
};

const applyTheme = (settings) => {
    const s = { ...DEFAULT_WEBSITE_SETTINGS, ...(settings || {}) };
    const root = document.documentElement;
    const primary = /^#[0-9a-fA-F]{6}$/.test(s.primary_color) ? s.primary_color : DEFAULT_WEBSITE_SETTINGS.primary_color;
    root.style.setProperty('--color-primary-400', shade(primary, 15));
    root.style.setProperty('--color-primary-500', primary);
    root.style.setProperty('--color-primary-600', shade(primary, -15));
    root.style.setProperty('--color-primary-700', shade(primary, -30));

    if (/^#[0-9a-fA-F]{6}$/.test(s.background_color)) {
        document.body.style.backgroundColor = s.background_color;
    }
    if (/^#[0-9a-fA-F]{6}$/.test(s.text_color)) {
        document.body.style.color = s.text_color;
    }
};

export const useWebsiteStore = create((set, get) => ({
    slug: null,
    data: null,
    loading: false,
    error: null,

    fetchWebsite: async (slug) => {
        const state = get();
        if (state.slug === slug && state.data && !state.error) return;
        set({ slug, loading: true, error: null });
        try {
            const res = await publicApi.getWebsite(slug);
            set({ data: res.data, loading: false });
            applyTheme(res.data?.settings);
        } catch (err) {
            set({ data: null, loading: false, error: err });
            applyTheme(DEFAULT_WEBSITE_SETTINGS);
        }
    },

    getSettings: () => {
        const data = get().data;
        return {
            ...DEFAULT_WEBSITE_SETTINGS,
            ...(data?.settings || {}),
            display_name: data?.settings?.display_name || data?.restaurant?.name || '',
        };
    },
}));
