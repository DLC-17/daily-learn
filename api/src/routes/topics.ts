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
    const { rows } = await pool.query(
      `SELECT t.id, t.name, t.created_at,
              COUNT(c.id)::int AS content_count
       FROM topics t
       LEFT JOIN content c ON c.topic_id = t.id
       WHERE t.user_id = $1
       GROUP BY t.id
       ORDER BY t.name ASC`,
      [user.id],
    );
    res.json({ data: rows });
  }),
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const name = ((req.body as Record<string, unknown>)['name'] as string | undefined)?.trim();
    if (!name) throw new AppError(400, 'Topic name is required', 'VALIDATION_ERROR');
    if (name.length > 100) throw new AppError(400, 'Topic name too long', 'VALIDATION_ERROR');

    const { rows } = await pool.query(
      `INSERT INTO topics (user_id, name)
       VALUES ($1, $2)
       ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, created_at`,
      [user.id, name],
    );
    res.status(201).json({ data: rows[0] });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const { rows } = await pool.query(
      'DELETE FROM topics WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params['id'], user.id],
    );
    if (rows.length === 0) throw new AppError(404, 'Topic not found', 'NOT_FOUND');
    res.status(204).end();
  }),
);

export default router;
