import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import api from './api';

export const setupNotifications = async (): Promise<void> => {
  if (Platform.OS === 'web') return;

  // expo-notifications remote push was removed from Expo Go in SDK 53.
  // Skip entirely when running in Expo Go to avoid warnings and errors.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

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
