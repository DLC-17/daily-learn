import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import api from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const setupNotifications = async (): Promise<void> => {
  if (Platform.OS === 'web') return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  const tokenData = await Notifications.getExpoPushTokenAsync();

  try {
    await api.patch('/user/push-token', { pushToken: tokenData.data });
  } catch {
    // Non-fatal: notification registration shouldn't crash the app
  }

  Notifications.addNotificationResponseReceivedListener((response) => {
    const questionId = response.notification.request.content.data?.[
      'questionId'
    ] as string | undefined;
    if (questionId) {
      router.push(`/quiz/${questionId}` as const);
    }
  });
};
