import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { AppError, AuthRequest } from '../types/index';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const contentId = (req.query['content_id'] as string) || null;
    const topicId = (req.query['topic_id'] as string) || null;
    const exclude = (req.query['exclude'] as string) || null;

    const { rows } = await pool.query(
      `SELECT q.id, q.question_text, q.options::json AS options, q.correct_index,
              q.times_shown, q.times_correct,
              CASE WHEN q.times_shown = 0 THEN 0.6
                   ELSE 1.0 - (q.times_correct::float / q.times_shown)
              END AS priority_score
       FROM questions q
       JOIN content c ON c.id = q.content_id
       WHERE c.user_id = $1
         AND ($2::text IS NULL OR c.id::text = $2)
         AND ($3::text IS NULL OR c.topic_id::text = $3)
         AND ($4::text IS NULL OR q.id::text != $4)
       ORDER BY priority_score DESC`,
      [user.id, contentId, topicId, exclude],
    );

    res.json({ data: rows });
  }),
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;

    const { rows } = await pool.query(
      `SELECT q.id, q.question_text, q.options::json AS options, q.correct_index, q.source_text
       FROM questions q
       JOIN content c ON c.id = q.content_id
       WHERE q.id = $1 AND c.user_id = $2`,
      [req.params['id'], user.id],
    );

    if (rows.length === 0) throw new AppError(404, 'Question not found', 'NOT_FOUND');
    res.json({ data: rows[0] });
  }),
);

export default router;
