import Expo from 'expo-server-sdk';
import { pool } from '../db/client';

const expo = new Expo();

export interface PushPayload {
  pushToken: string;
  questionId: string;
  questionText: string;
}

export const sendPush = async (payload: PushPayload): Promise<void> => {
  if (!Expo.isExpoPushToken(payload.pushToken)) return;

  const chunks = expo.chunkPushNotifications([
    {
      to: payload.pushToken,
      sound: 'default',
      title: 'Daily Learn',
      body: payload.questionText,
      data: { questionId: payload.questionId },
    },
  ]);

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          const details = (ticket as { details?: { error?: string } }).details;
          if (details?.error === 'DeviceNotRegistered') {
            await pool.query('UPDATE users SET push_token = NULL WHERE push_token = $1', [
              payload.pushToken,
            ]);
          }
        }
      }
    } catch (err) {
      console.error('[push] send error:', err instanceof Error ? err.message : String(err));
    }
  }
};
