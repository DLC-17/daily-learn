import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/authStore';

const ACCESS_KEY = 'daily_learn_access_token';
const REFRESH_KEY = 'daily_learn_refresh_token';

const api = axios.create({
  baseURL: process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:8080',
  timeout: 120_000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(ACCESS_KEY);
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosError = error as { response?: { status: number }; config?: Record<string, unknown> };
    if (axiosError.response?.status !== 401) return Promise.reject(error);

    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
      if (!refreshToken) return Promise.reject(error);

      const baseURL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:8080';
      const { data } = await axios.post<{ data: { accessToken: string; refreshToken: string } }>(
        `${baseURL}/auth/refresh`,
        { refreshToken },
      );
      const newToken = data.data.accessToken;

      await SecureStore.setItemAsync(ACCESS_KEY, newToken);
      await SecureStore.setItemAsync(REFRESH_KEY, data.data.refreshToken);
      if (axiosError.config) {
        axiosError.config['headers'] = {
          ...(axiosError.config['headers'] as Record<string, string>),
          Authorization: `Bearer ${newToken}`,
        };
        return api.request(axiosError.config);
      }
    } catch {
      await useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export default api;
