import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthUser } from '../types/index';

const BCRYPT_ROUNDS = 12;

const secret = (): string => {
  const s = process.env['JWT_SECRET'];
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
};

const refreshSecret = (): string => {
  const s = process.env['JWT_REFRESH_SECRET'];
  if (!s) throw new Error('JWT_REFRESH_SECRET is not set');
  return s;
};

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

export const comparePassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

export const signAccessToken = (user: AuthUser): string =>
  jwt.sign({ id: user.id, email: user.email }, secret(), { expiresIn: '15m' });

export const signRefreshToken = (user: AuthUser): string =>
  jwt.sign({ id: user.id, email: user.email }, refreshSecret(), { expiresIn: '7d' });

export const verifyAccessToken = (token: string): AuthUser => {
  const payload = jwt.verify(token, secret()) as jwt.JwtPayload;
  return { id: payload['id'] as string, email: payload['email'] as string };
};

export const verifyRefreshToken = (token: string): AuthUser => {
  const payload = jwt.verify(token, refreshSecret()) as jwt.JwtPayload;
  return { id: payload['id'] as string, email: payload['email'] as string };
};
