'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function SettingsPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-3xl font-bold text-[#1E293B] mb-6">Settings</h1>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0]">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
            Account
          </p>
          <button
            onClick={() => { logout(); router.replace('/login'); }}
            className="text-sm text-[#EF4444] font-medium hover:opacity-70 transition"
          >
            Sign Out
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
            About
          </p>
          <p className="text-sm text-[#64748B]">
            Daily Learn — build better habits, one question at a time.
          </p>
          <p className="text-xs text-[#94A3B8] mt-2">
            Push notifications are available on the mobile app.
          </p>
        </div>
      </div>
    </div>
  );
}
