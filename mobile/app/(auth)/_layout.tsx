import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

export default function AuthLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && accessToken) {
      router.replace('/(tabs)');
    }
  }, [hydrated, accessToken, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
