import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const PushTokenSchema = z.object({
  pushToken: z.string().min(1),
});

export const CreateContentSchema = z.object({
  title: z.string().min(1).max(255),
  text: z.string().min(1).optional(),
});

export const SubmitAnswerSchema = z.object({
  question_id: z.string().uuid(),
  answer_index: z.number().int().min(0).max(3),
});
