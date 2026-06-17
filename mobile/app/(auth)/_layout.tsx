import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

export default function AuthLayout() {
  const { accessToken, hydrated } = useAuthStore((s) => ({
    accessToken: s.accessToken,
    hydrated: s.hydrated,
  }));

  if (hydrated && accessToken) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
