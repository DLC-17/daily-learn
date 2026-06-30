'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

const NAV = [
  { href: '/dashboard', label: 'Home', icon: '⌂' },
  { href: '/dashboard/upload', label: 'Upload', icon: '↑' },
  { href: '/dashboard/history', label: 'History', icon: '◷' },
  { href: '/dashboard/flashcards', label: 'Flashcards', icon: '▣' },
  { href: '/dashboard/flagged', label: 'Flagged', icon: '⚑' },
  { href: '/dashboard/settings', label: 'Settings', icon: '◉' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (hydrated && !accessToken) router.replace('/login');
  }, [hydrated, accessToken, router]);

  if (!hydrated || !accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#5B8EF7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#09090C]">
      {/* Sidebar */}
      <aside className="w-52 bg-[#0D0D11] border-r border-[#1A1A20] flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-[#1A1A20]">
          <span className="text-sm font-semibold text-[#E8E8EC] tracking-tight">Daily Learn</span>
        </div>
        <nav className="flex-1 p-2 flex flex-col gap-0.5 mt-1">
          {NAV.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-[#0C1828] text-[#5B8EF7]'
                    : 'text-[#76769A] hover:bg-[#131317] hover:text-[#E8E8EC]'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-[#1A1A20]">
          <button
            onClick={() => { logout(); router.replace('/login'); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#76769A] hover:bg-[#1A0808] hover:text-[#EF4444] transition"
          >
            <span className="text-base leading-none">⏻</span>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
