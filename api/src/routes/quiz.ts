import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { AppError, AuthRequest } from '../types/index';
import { SubmitAnswerSchema } from '../types/schemas';

const router = Router();

router.post(
  '/session',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const body = SubmitAnswerSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Invalid request body', 'VALIDATION_ERROR');

    const { question_id, answer_index } = body.data;

    const { rows } = await pool.query<{
      id: string;
      correct_index: number;
      explanation: string | null;
      user_id: string;
      options: string[];
    }>(
      `SELECT q.id, q.correct_index, q.explanation, q.options, c.user_id
       FROM questions q
       JOIN content c ON c.id = q.content_id
       WHERE q.id = $1`,
      [question_id],
    );

    if (rows.length === 0) throw new AppError(404, 'Question not found', 'NOT_FOUND');
    const question = rows[0]!;
    if (question.user_id !== user.id) throw new AppError(403, 'Access denied', 'FORBIDDEN');

    const is_correct = question.correct_index === answer_index;

    await pool.query(
      `INSERT INTO quiz_sessions (user_id, question_id, answer_index, is_correct)
       VALUES ($1, $2, $3, $4)`,
      [user.id, question_id, answer_index, is_correct],
    );

    await pool.query(
      is_correct
        ? 'UPDATE questions SET times_shown = times_shown + 1, times_correct = times_correct + 1 WHERE id = $1'
        : 'UPDATE questions SET times_shown = times_shown + 1 WHERE id = $1',
      [question_id],
    );

    await pool.query('UPDATE users SET last_active = now() WHERE id = $1', [user.id]);

    const correctOption = question.options[question.correct_index];
    const explanation =
      question.explanation ??
      (correctOption
        ? `The correct answer was: ${correctOption}`
        : 'See the source material for details.');

    res.json({ data: { correct: is_correct, explanation } });
  }),
);

router.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const limit = Math.min(parseInt((req.query['limit'] as string | undefined) ?? '20', 10), 100);
    const offset = parseInt((req.query['offset'] as string | undefined) ?? '0', 10);

    const { rows } = await pool.query(
      `SELECT qs.id, qs.question_id, qs.answer_index, qs.is_correct, qs.shown_at,
              q.question_text, q.correct_index, q.options
       FROM quiz_sessions qs
       JOIN questions q ON q.id = qs.question_id
       WHERE qs.user_id = $1
       ORDER BY qs.shown_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset],
    );

    res.json({ data: rows });
  }),
);

export default router;
