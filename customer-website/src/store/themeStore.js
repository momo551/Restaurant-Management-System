import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
    persist(
        (set) => ({
            isDarkMode: false,
            toggleDarkMode: () => set((state) => {
                const newValue = !state.isDarkMode;
                if (newValue) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
                return { isDarkMode: newValue };
            }),
            initTheme: () => {
                const isDark = get().isDarkMode;
                if (isDark) document.documentElement.classList.add('dark');
            }
        }),
        {
            name: 'restaurant-theme',
        }
    )
);
