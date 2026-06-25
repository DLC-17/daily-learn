'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface UserProfile { streak_count: number; last_active: string | null }
interface QuizSession { id: string; is_correct: boolean; shown_at: string }
interface Topic { id: string; name: string }
interface Question { id: string }

const todayStr = () => new Date().toISOString().split('T')[0]!;

export default function DashboardPage() {
  const router = useRouter();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<UserProfile> => {
      const { data } = await api.get<{ data: UserProfile }>('/user/profile');
      return data.data;
    },
  });

  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions-home'],
    queryFn: async (): Promise<QuizSession[]> => {
      const { data } = await api.get<{ data: QuizSession[] }>('/quiz/sessions?limit=100');
      return data.data;
    },
  });

  const { data: topics } = useQuery({
    queryKey: ['topics'],
    queryFn: async (): Promise<Topic[]> => {
      const { data } = await api.get<{ data: Topic[] }>('/topics');
      return data.data;
    },
  });

  const { data: nextQuestion } = useQuery({
    queryKey: ['next-question', selectedTopicId],
    queryFn: async (): Promise<Question | null> => {
      const params = selectedTopicId ? `?topic_id=${selectedTopicId}` : '';
      const { data } = await api.get<{ data: Question[] }>(`/questions${params}`);
      return data.data[0] ?? null;
    },
  });

  const isLoading = profileLoading || sessionsLoading;
  const today = todayStr();
  const todaySessions = (sessions ?? []).filter((s) => s.shown_at.startsWith(today));
  const todayCorrect = todaySessions.filter((s) => s.is_correct).length;
  const totalSessions = sessions?.length ?? 0;
  const totalCorrect = (sessions ?? []).filter((s) => s.is_correct).length;
  const accuracy = totalSessions > 0 ? Math.round((totalCorrect / totalSessions) * 100) : 0;
  const dailyGoal = 3;
  const progress = Math.min(todaySessions.length, dailyGoal);

  const topicItems = [{ id: null as string | null, name: 'All' }, ...(topics ?? [])];

  const startQuiz = () => {
    if (!nextQuestion) return;
    const param = selectedTopicId ? `&topicId=${selectedTopicId}` : '';
    router.push(`/quiz?id=${nextQuestion.id}${param}`);
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-[#E8E8EC] tracking-tight">Home</h1>
        <button
          onClick={() => { void refetchProfile(); void refetchSessions(); }}
          className="text-xs text-[#76769A] hover:text-[#5B8EF7] transition"
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-20">
          <div className="w-5 h-5 border-2 border-[#5B8EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Streak */}
          <div className="bg-[#131317] rounded-xl p-5 flex items-center gap-5 border border-[#222228]">
            <span className="text-4xl">🔥</span>
            <div>
              <p className="text-3xl font-bold text-[#E8E8EC] leading-none mb-1">
                {profile?.streak_count ?? 0}
              </p>
              <p className="text-xs text-[#76769A]">day streak</p>
            </div>
          </div>

          {/* Topic filter */}
          {topicItems.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {topicItems.map((item) => {
                const active = selectedTopicId === item.id;
                return (
                  <button
                    key={item.id ?? 'all'}
                    onClick={() => setSelectedTopicId(item.id)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition ${
                      active
                        ? 'bg-[#0C1828] border-[#1A3460] text-[#5B8EF7]'
                        : 'bg-transparent border-[#222228] text-[#76769A] hover:border-[#38384A] hover:text-[#E8E8EC]'
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Start Quiz */}
          <button
            onClick={startQuiz}
            disabled={!nextQuestion}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#5B8EF7] hover:bg-[#3A6EDB] transition disabled:opacity-30"
          >
            {nextQuestion ? 'Start Quiz' : 'No questions yet — upload some content first'}
          </button>

          {/* Today's progress */}
          <div className="bg-[#131317] rounded-xl p-5 border border-[#222228]">
            <p className="text-xs font-semibold text-[#76769A] uppercase tracking-wider mb-4">
              Today's Progress
            </p>
            <div className="flex items-center gap-2 mb-3">
              {Array.from({ length: dailyGoal }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    i < progress ? 'bg-[#5B8EF7]' : 'bg-[#222228]'
                  }`}
                />
              ))}
            </div>
            <p className={`text-xs ${progress >= dailyGoal ? 'text-[#22C55E]' : 'text-[#76769A]'}`}>
              {progress === 0
                ? `0 of ${dailyGoal} questions today`
                : progress < dailyGoal
                ? `${progress} of ${dailyGoal} — ${dailyGoal - progress} more to go`
                : 'Daily goal complete'}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: totalSessions, label: 'Answered' },
              { value: `${accuracy}%`, label: 'Accuracy' },
              { value: todaySessions.length > 0 ? String(todayCorrect) : '—', label: 'Today' },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="bg-[#131317] rounded-xl p-4 text-center border border-[#222228]"
              >
                <p className="text-xl font-bold text-[#E8E8EC]">{value}</p>
                <p className="text-xs text-[#76769A] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
