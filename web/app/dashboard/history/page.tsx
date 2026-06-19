'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface Session {
  id: string;
  question_text: string;
  is_correct: boolean;
  shown_at: string;
}

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function HistoryPage() {
  const { data: sessions, isLoading, refetch } = useQuery({
    queryKey: ['sessions-history'],
    queryFn: async (): Promise<Session[]> => {
      const { data } = await api.get<{ data: Session[] }>('/quiz/sessions?limit=50');
      return data.data;
    },
  });

  const total = sessions?.length ?? 0;
  const correct = (sessions ?? []).filter((s) => s.is_correct).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-[#1E293B]">History</h1>
        <button onClick={() => void refetch()} className="text-sm text-[#4F8EF7] hover:underline">
          Refresh
        </button>
      </div>

      {total > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] flex mb-4">
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-[#1E293B]">{total}</p>
            <p className="text-xs text-[#64748B] mt-0.5">Answered</p>
          </div>
          <div className="w-px bg-[#E2E8F0] mx-4" />
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-[#1E293B]">{accuracy}%</p>
            <p className="text-xs text-[#64748B] mt-0.5">Correct</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center mt-16">
          <div className="w-8 h-8 border-2 border-[#4F8EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (sessions ?? []).length === 0 ? (
        <div className="text-center mt-16">
          <p className="text-lg font-semibold text-[#1E293B] mb-2">No quiz sessions yet.</p>
          <p className="text-sm text-[#64748B]">
            Answer questions from the Quiz page to see your history here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(sessions ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-start gap-3 bg-white rounded-xl px-4 py-3 border border-[#E2E8F0]"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold ${
                  s.is_correct ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'
                }`}
              >
                {s.is_correct ? '✓' : '✗'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#1E293B] line-clamp-2">{s.question_text}</p>
                <p className="text-xs text-[#64748B] mt-1">{formatDate(s.shown_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
