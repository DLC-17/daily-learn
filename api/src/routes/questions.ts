import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { AppError, AuthRequest } from '../types/index';

const router = Router();

// List questions for the quiz — flagged questions are excluded
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    // content_ids: comma-separated list of content IDs; falls back to legacy content_id
    const contentIds = (req.query['content_ids'] as string) || (req.query['content_id'] as string) || null;
    const topicId = (req.query['topic_id'] as string) || null;
    const groupId = (req.query['group_id'] as string) || null;
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
         AND (q.flagged IS NOT TRUE)
         AND ($2::text IS NULL OR c.id::text = ANY(string_to_array($2, ',')))
         AND ($3::text IS NULL OR c.topic_id::text = $3)
         AND ($4::text IS NULL OR q.id::text != $4)
         AND ($5::text IS NULL OR c.group_id::text = $5)
       ORDER BY priority_score DESC, RANDOM()`,
      [user.id, contentIds, topicId, exclude, groupId],
    );

    res.json({ data: rows });
  }),
);

// List flagged questions — must be defined before /:id to avoid route collision
router.get(
  '/flagged',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;

    const { rows } = await pool.query(
      `SELECT q.id, q.question_text, q.options::json AS options, q.correct_index,
              q.flag_reason, q.flagged_at, c.title AS content_title, c.id AS content_id
       FROM questions q
       JOIN content c ON c.id = q.content_id
       WHERE c.user_id = $1 AND q.flagged = TRUE
       ORDER BY q.flagged_at DESC`,
      [user.id],
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

// Flag a question
router.post(
  '/:id/flag',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const reason = ((req.body as Record<string, unknown>)['reason'] as string | undefined)?.trim() ?? null;
    if (reason && reason.length > 255) throw new AppError(400, 'Flag reason too long', 'VALIDATION_ERROR');

    const { rows } = await pool.query(
      `UPDATE questions q
       SET flagged = TRUE, flag_reason = $3, flagged_at = now()
       FROM content c
       WHERE q.id = $1 AND q.content_id = c.id AND c.user_id = $2
       RETURNING q.id`,
      [req.params['id'], user.id, reason],
    );

    if (rows.length === 0) throw new AppError(404, 'Question not found', 'NOT_FOUND');
    res.json({ data: { id: rows[0].id } });
  }),
);

// Unflag a question
router.delete(
  '/:id/flag',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;

    const { rows } = await pool.query(
      `UPDATE questions q
       SET flagged = FALSE, flag_reason = NULL, flagged_at = NULL
       FROM content c
       WHERE q.id = $1 AND q.content_id = c.id AND c.user_id = $2
       RETURNING q.id`,
      [req.params['id'], user.id],
    );

    if (rows.length === 0) throw new AppError(404, 'Question not found', 'NOT_FOUND');
    res.json({ data: { id: rows[0].id } });
  }),
);

// Delete a question permanently
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;

    const { rows } = await pool.query(
      `DELETE FROM questions q
       USING content c
       WHERE q.id = $1 AND q.content_id = c.id AND c.user_id = $2
       RETURNING q.id`,
      [req.params['id'], user.id],
    );

    if (rows.length === 0) throw new AppError(404, 'Question not found', 'NOT_FOUND');
    res.status(204).end();
  }),
);

export default router;
