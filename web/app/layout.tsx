import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Daily Learn',
  description: 'Build better habits, one question at a time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-[#09090C] text-[#E8E8EC] min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
