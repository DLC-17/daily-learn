'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FieldErrors = Partial<Record<'email' | 'password', string>>;

export default function LoginPage() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = LoginSchema.safeParse({ email, password });
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
        '/auth/login',
        result.data,
      );
      setTokens(data.data.accessToken, data.data.refreshToken);
      router.replace('/dashboard');
    } catch (err) {
      setServerError(
        isAxiosError(err)
          ? (err.response?.data as { error?: { message?: string } })?.error?.message ?? 'Login failed'
          : 'Login failed',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-bold text-[#1E293B] text-center mb-1">Daily Learn</h1>
        <p className="text-sm text-[#64748B] text-center mb-8">
          Build better habits, one question at a time.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={`w-full bg-white border rounded-xl px-4 py-3 text-[#1E293B] placeholder-[#64748B] outline-none focus:ring-2 focus:ring-[#4F8EF7] transition text-base ${
                errors.email ? 'border-[#EF4444]' : 'border-[#E2E8F0]'
              }`}
            />
            {errors.email && <p className="text-xs text-[#EF4444] mt-1">{errors.email}</p>}
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={`w-full bg-white border rounded-xl px-4 py-3 text-[#1E293B] placeholder-[#64748B] outline-none focus:ring-2 focus:ring-[#4F8EF7] transition text-base ${
                errors.password ? 'border-[#EF4444]' : 'border-[#E2E8F0]'
              }`}
            />
            {errors.password && <p className="text-xs text-[#EF4444] mt-1">{errors.password}</p>}
          </div>

          {serverError && <p className="text-sm text-[#EF4444] text-center">{serverError}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-[#4F8EF7] text-white font-semibold py-3 rounded-xl mt-1 hover:bg-[#2563EB] transition disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <Link href="/register" className="text-sm text-[#4F8EF7] text-center py-2 hover:underline">
            Don't have an account? Register
          </Link>
        </form>
      </div>
    </div>
  );
}
