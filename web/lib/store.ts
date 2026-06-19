import { create } from 'zustand';
import { ACCESS_KEY, REFRESH_KEY } from './api';

interface AuthState {
  accessToken: string | null;
  hydrated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  hydrated: false,

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    set({ accessToken });
  },

  logout: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    set({ accessToken: null });
  },

  hydrate: () => {
    const accessToken = localStorage.getItem(ACCESS_KEY);
    set({ accessToken, hydrated: true });
  },
}));
