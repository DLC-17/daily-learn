import cron from 'node-cron';
import { pool } from '../db/client';
import { sendPush } from './pushNotifications';
import { setSchedulerRunning } from '../state';

// UTC notification windows [startHour, endHour)
const WINDOWS = [
  [8, 11], // morning
  [12, 15], // afternoon
  [17, 20], // evening
] as const;

const randomTimeInWindow = (startHour: number, endHour: number): Date => {
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  const startMin = startHour * 60;
  const endMin = endHour * 60;
  const rand = Math.floor(Math.random() * (endMin - startMin)) + startMin;
  base.setUTCHours(Math.floor(rand / 60), rand % 60, 0, 0);
  return base;
};

export const runMidnightJob = async (): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];

  const { rows: users } = await pool.query<{ id: string }>(`
    SELECT DISTINCT u.id FROM users u
    WHERE u.push_token IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM questions q
        JOIN content c ON c.id = q.content_id
        WHERE c.user_id = u.id
      )
  `);

  for (const user of users) {
    for (let slot = 0; slot < WINDOWS.length; slot++) {
      const window = WINDOWS[slot];
      if (!window) continue;
      const scheduledAt = randomTimeInWindow(window[0], window[1]);
      await pool.query(
        `INSERT INTO scheduled_notifications (user_id, slot, scheduled_at, date)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, date, slot) DO NOTHING`,
        [user.id, slot, scheduledAt, today],
      );
    }
  }
};

export const runDispatchJob = async (): Promise<void> => {
  const { rows: due } = await pool.query<{
    id: string;
    user_id: string;
    push_token: string;
    date: string;
  }>(`
    SELECT sn.id, sn.user_id, u.push_token, sn.date::text
    FROM scheduled_notifications sn
    JOIN users u ON u.id = sn.user_id
    WHERE sn.scheduled_at <= now()
      AND sn.sent_at IS NULL
      AND u.push_token IS NOT NULL
  `);

  for (const row of due) {
    const { rows: candidates } = await pool.query<{ id: string; question_text: string }>(`
      SELECT q.id, q.question_text,
             CASE WHEN q.times_shown = 0 THEN 0.6
                  ELSE 1.0 - (q.times_correct::float / q.times_shown)
             END AS priority
      FROM questions q
      JOIN content c ON c.id = q.content_id
      WHERE c.user_id = $1
        AND q.id NOT IN (
          SELECT qs.question_id FROM quiz_sessions qs
          WHERE qs.user_id = $1 AND qs.shown_at::date = $2::date
        )
      ORDER BY priority DESC
      LIMIT 1
    `, [row.user_id, row.date]);

    const question = candidates[0];
    if (!question) continue;

    await sendPush({ pushToken: row.push_token, questionId: question.id, questionText: question.question_text });

    await pool.query(
      `UPDATE scheduled_notifications SET sent_at = now(), question_id = $1 WHERE id = $2`,
      [question.id, row.id],
    );
    await pool.query(
      'UPDATE questions SET times_shown = times_shown + 1 WHERE id = $1',
      [question.id],
    );
  }
};

export const startScheduler = (): void => {
  cron.schedule('0 0 * * *', () => {
    runMidnightJob().catch((err) =>
      console.error('[scheduler] midnight error:', err instanceof Error ? err.message : String(err)),
    );
  });

  cron.schedule('* * * * *', () => {
    runDispatchJob().catch((err) =>
      console.error('[scheduler] dispatch error:', err instanceof Error ? err.message : String(err)),
    );
  });

  setSchedulerRunning(true);
  console.log('[scheduler] started');
};
