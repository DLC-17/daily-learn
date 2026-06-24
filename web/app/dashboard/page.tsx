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
    const param = selectedTopicId ? `?topicId=${selectedTopicId}` : '';
    router.push(`/quiz/${nextQuestion.id}${param}`);
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-[#1E293B]">Daily Learn</h1>
        <button
          onClick={() => { void refetchProfile(); void refetchSessions(); }}
          className="text-sm text-[#4F8EF7] hover:underline"
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-16">
          <div className="w-8 h-8 border-2 border-[#4F8EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Streak */}
          <div className="bg-white rounded-2xl p-6 flex items-center gap-5 border border-[#E2E8F0]">
            <span className="text-5xl">🔥</span>
            <div>
              <p className="text-4xl font-bold text-[#1E293B]">{profile?.streak_count ?? 0}</p>
              <p className="text-sm text-[#64748B]">day streak</p>
            </div>
          </div>

          {/* Topic filter */}
          {topicItems.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {topicItems.map((item) => {
                const active = selectedTopicId === item.id;
                return (
                  <button
                    key={item.id ?? 'all'}
                    onClick={() => setSelectedTopicId(item.id)}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] transition ${
                      active
                        ? 'bg-[#4F8EF7] border-[#4F8EF7] text-white'
                        : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#4F8EF7]'
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
            className="w-full py-3 rounded-xl font-semibold text-white bg-[#4F8EF7] hover:bg-[#2563EB] transition disabled:opacity-40"
          >
            {nextQuestion ? 'Start Quiz' : 'No questions yet — upload some content first'}
          </button>

          {/* Today's progress */}
          <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
            <p className="text-sm font-semibold text-[#1E293B] mb-3">Today's Progress</p>
            <div className="flex items-center gap-2 mb-2">
              {Array.from({ length: dailyGoal }).map((_, i) => (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-full border-2 ${
                    i < progress ? 'bg-[#4F8EF7] border-[#4F8EF7]' : 'bg-[#E2E8F0] border-[#E2E8F0]'
                  }`}
                />
              ))}
              <span className="text-sm text-[#64748B] ml-1">{progress}/{dailyGoal} questions</span>
            </div>
            <p className={`text-sm ${progress >= dailyGoal ? 'text-[#22C55E] font-medium' : 'text-[#64748B]'}`}>
              {progress === 0
                ? 'Tap Start Quiz to begin.'
                : progress < dailyGoal
                ? `Keep going — ${dailyGoal - progress} more to complete today.`
                : 'All done for today. Great work!'}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: totalSessions, label: 'Answered' },
              { value: `${accuracy}%`, label: 'Accuracy' },
              { value: todaySessions.length > 0 ? String(todayCorrect) : '—', label: 'Today Correct' },
            ].map(({ value, label }) => (
              <div key={label} className="bg-white rounded-2xl p-4 text-center border border-[#E2E8F0]">
                <p className="text-2xl font-bold text-[#1E293B]">{value}</p>
                <p className="text-xs text-[#64748B] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
