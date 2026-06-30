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
      `SELECT g.id, g.name, g.created_at, COUNT(c.id)::int AS content_count
       FROM content_groups g
       LEFT JOIN content c ON c.group_id = g.id
       WHERE g.user_id = $1
       GROUP BY g.id
       ORDER BY g.name ASC`,
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
    if (!name) throw new AppError(400, 'Group name is required', 'VALIDATION_ERROR');
    if (name.length > 120) throw new AppError(400, 'Group name too long', 'VALIDATION_ERROR');

    const { rows } = await pool.query(
      `INSERT INTO content_groups (user_id, name)
       VALUES ($1, $2)
       ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, created_at`,
      [user.id, name],
    );
    res.status(201).json({ data: rows[0] });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const name = ((req.body as Record<string, unknown>)['name'] as string | undefined)?.trim();
    if (!name) throw new AppError(400, 'Group name is required', 'VALIDATION_ERROR');
    if (name.length > 120) throw new AppError(400, 'Group name too long', 'VALIDATION_ERROR');

    const { rows } = await pool.query(
      `UPDATE content_groups SET name = $3
       WHERE id = $1 AND user_id = $2
       RETURNING id, name, created_at`,
      [req.params['id'], user.id, name],
    );
    if (rows.length === 0) throw new AppError(404, 'Group not found', 'NOT_FOUND');
    res.json({ data: rows[0] });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const { rows } = await pool.query(
      'DELETE FROM content_groups WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params['id'], user.id],
    );
    if (rows.length === 0) throw new AppError(404, 'Group not found', 'NOT_FOUND');
    res.status(204).end();
  }),
);

export default router;
