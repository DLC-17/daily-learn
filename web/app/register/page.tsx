'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const RegisterSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FieldErrors = Partial<Record<'email' | 'password' | 'confirmPassword', string>>;

export default function RegisterPage() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = RegisterSchema.safeParse({ email, password, confirmPassword });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setServerError('');
    setLoading(true);
    try {
      const { data } = await api.post<{ data: { accessToken: string; refreshToken: string } }>(
        '/auth/register',
        { email: result.data.email, password: result.data.password },
      );
      setTokens(data.data.accessToken, data.data.refreshToken);
      router.replace('/dashboard');
    } catch (err) {
      setServerError(
        isAxiosError(err)
          ? (err.response?.data as { error?: { message?: string } })?.error?.message ??
            'Registration failed'
          : 'Registration failed',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090C] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-semibold text-[#E8E8EC] tracking-tight mb-1.5">Create Account</h1>
          <p className="text-sm text-[#76769A]">Start your daily learning journey.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={`w-full bg-[#131317] border rounded-xl px-4 py-3 text-[#E8E8EC] placeholder-[#48486A] outline-none focus:ring-1 focus:ring-[#5B8EF7] transition text-sm ${
                errors.email ? 'border-[#EF4444]' : 'border-[#222228]'
              }`}
            />
            {errors.email && <p className="text-xs text-[#EF4444] mt-1.5">{errors.email}</p>}
          </div>

          <div>
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={`w-full bg-[#131317] border rounded-xl px-4 py-3 text-[#E8E8EC] placeholder-[#48486A] outline-none focus:ring-1 focus:ring-[#5B8EF7] transition text-sm ${
                errors.password ? 'border-[#EF4444]' : 'border-[#222228]'
              }`}
            />
            {errors.password && <p className="text-xs text-[#EF4444] mt-1.5">{errors.password}</p>}
          </div>

          <div>
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className={`w-full bg-[#131317] border rounded-xl px-4 py-3 text-[#E8E8EC] placeholder-[#48486A] outline-none focus:ring-1 focus:ring-[#5B8EF7] transition text-sm ${
                errors.confirmPassword ? 'border-[#EF4444]' : 'border-[#222228]'
              }`}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-[#EF4444] mt-1.5">{errors.confirmPassword}</p>
            )}
          </div>

          {serverError && <p className="text-xs text-[#EF4444] text-center">{serverError}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-[#5B8EF7] text-white text-sm font-semibold py-3 rounded-xl mt-1 hover:bg-[#3A6EDB] transition disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating account…
              </span>
            ) : (
              'Create Account'
            )}
          </button>

          <Link
            href="/login"
            className="text-xs text-[#76769A] text-center py-2 hover:text-[#5B8EF7] transition"
          >
            Already have an account? <span className="text-[#5B8EF7]">Sign In</span>
          </Link>
        </form>
      </div>
    </div>
  );
}
