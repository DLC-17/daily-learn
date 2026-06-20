import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'daily_learn_theme';

interface ThemeState {
  isDark: boolean;
  hydrated: boolean;
  toggle: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: false,
  hydrated: false,

  toggle: async () => {
    const next = !get().isDark;
    set({ isDark: next });
    await SecureStore.setItemAsync(THEME_KEY, next ? '1' : '0');
  },

  hydrate: async () => {
    const stored = await SecureStore.getItemAsync(THEME_KEY);
    set({ isDark: stored === '1', hydrated: true });
  },
}));
