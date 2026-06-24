import axios from 'axios';

export const ACCESS_KEY = 'daily_learn_access_token';
export const REFRESH_KEY = 'daily_learn_refresh_token';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
  timeout: 120_000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(ACCESS_KEY);
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosError = error as { response?: { status: number }; config?: Record<string, unknown> };
    if (axiosError.response?.status !== 401) return Promise.reject(error);

    try {
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (!refreshToken) return Promise.reject(error);

      const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
      const { data } = await axios.post<{ data: { accessToken: string } }>(
        `${baseURL}/auth/refresh`,
        { refreshToken },
      );
      const newToken = data.data.accessToken;
      localStorage.setItem(ACCESS_KEY, newToken);

      if (axiosError.config) {
        axiosError.config['headers'] = {
          ...(axiosError.config['headers'] as Record<string, string>),
          Authorization: `Bearer ${newToken}`,
        };
        return api.request(axiosError.config);
      }
    } catch {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    }
    return Promise.reject(error);
  },
);

export default api;
