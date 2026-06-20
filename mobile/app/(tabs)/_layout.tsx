import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useColors } from '../../hooks/useColors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  index:    { active: 'home',           inactive: 'home-outline' },
  upload:   { active: 'cloud-upload',   inactive: 'cloud-upload-outline' },
  history:  { active: 'time',           inactive: 'time-outline' },
  settings: { active: 'settings',       inactive: 'settings-outline' },
};

export default function TabsLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    if (hydrated && !accessToken) {
      router.replace('/(auth)/login');
    }
  }, [hydrated, accessToken]);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const name = icons ? (focused ? icons.active : icons.inactive) : 'ellipse-outline';
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index"    options={{ title: 'Home' }} />
      <Tabs.Screen name="upload"   options={{ title: 'Upload' }} />
      <Tabs.Screen name="history"  options={{ title: 'History' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
