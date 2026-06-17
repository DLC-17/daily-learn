import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { AppError, AuthRequest } from '../types/index';
import { PushTokenSchema } from '../types/schemas';

const router = Router();

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
