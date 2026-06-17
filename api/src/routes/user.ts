import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { AppError, AuthRequest } from '../types/index';
import { PushTokenSchema } from '../types/schemas';

const router = Router();

router.get(
  '/profile',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const { rows } = await pool.query<{
      streak_count: number;
      last_active: string | null;
    }>('SELECT streak_count, last_active FROM users WHERE id = $1', [user.id]);
    if (rows.length === 0) throw new AppError(404, 'User not found', 'NOT_FOUND');
    res.json({ data: rows[0] });
  }),
);

router.patch(
  '/push-token',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthRequest;
    const body = PushTokenSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Invalid request body', 'VALIDATION_ERROR');

    await pool.query('UPDATE users SET push_token = $1 WHERE id = $2', [
      body.data.pushToken,
      user.id,
    ]);
    res.json({ data: { registered: true } });
  }),
);

export default router;
