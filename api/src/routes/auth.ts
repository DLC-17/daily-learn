import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError } from '../types/index';
import { RegisterSchema, LoginSchema, RefreshSchema } from '../types/schemas';
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../services/auth';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts — try again in 15 minutes' },
    });
  },
});

const router = Router();

router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const body = RegisterSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Invalid request body', 'VALIDATION_ERROR');

    const { email, password } = body.data;
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if ((existing.rowCount ?? 0) > 0)
      throw new AppError(409, 'Email already registered', 'CONFLICT');

    const passwordHash = await hashPassword(password);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash],
    );
    const user = rows[0] as { id: string; email: string };

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

    res.status(201).json({ data: { accessToken, refreshToken, user } });
  }),
);

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const body = LoginSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Invalid request body', 'VALIDATION_ERROR');

    const { email, password } = body.data;
    const { rows } = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email],
    );
    if (rows.length === 0) throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');

    const user = rows[0] as { id: string; email: string; password_hash: string };
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');

    const accessToken = signAccessToken({ id: user.id, email: user.email });
    const refreshToken = signRefreshToken({ id: user.id, email: user.email });
    await pool.query(
      'UPDATE users SET refresh_token = $1, last_active = now() WHERE id = $2',
      [refreshToken, user.id],
    );

    res.json({ data: { accessToken, refreshToken, user: { id: user.id, email: user.email } } });
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const body = RefreshSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, 'Invalid request body', 'VALIDATION_ERROR');

    const { refreshToken } = body.data;
    let decoded: { id: string; email: string };
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, 'Invalid refresh token', 'UNAUTHORIZED');
    }

    const { rows } = await pool.query(
      'SELECT id, email FROM users WHERE id = $1 AND refresh_token = $2',
      [decoded.id, refreshToken],
    );
    if (rows.length === 0) throw new AppError(401, 'Refresh token revoked', 'UNAUTHORIZED');

    const accessToken = signAccessToken(decoded);
    const newRefreshToken = signRefreshToken(decoded);
    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [newRefreshToken, decoded.id]);
    res.json({ data: { accessToken, refreshToken: newRefreshToken } });
  }),
);

export default router;
