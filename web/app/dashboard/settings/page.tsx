'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function SettingsPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-xl font-semibold text-[#E8E8EC] tracking-tight mb-8">Settings</h1>

      <div className="bg-[#131317] rounded-xl border border-[#222228] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#222228]">
          <p className="text-xs font-semibold text-[#48486A] uppercase tracking-wider mb-3">Account</p>
          <button
            onClick={() => { logout(); router.replace('/login'); }}
            className="text-sm text-[#EF4444] font-medium hover:opacity-70 transition"
          >
            Sign Out
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-[#48486A] uppercase tracking-wider mb-3">About</p>
          <p className="text-sm text-[#76769A]">
            Daily Learn — build better habits, one question at a time.
          </p>
          <p className="text-xs text-[#48486A] mt-2">
            Push notifications available on the mobile app.
          </p>
        </div>
      </div>
    </div>
  );
}
