'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface UserProfile { streak_count: number; last_active: string | null }
interface QuizSession { id: string; is_correct: boolean; shown_at: string }
interface Topic { id: string; name: string }
interface Content { id: string; title: string; topic_id: string | null; group_id: string | null; group_name: string | null }
interface Question { id: string }

type DayCell = { date: string; count: number };

function buildMonthGrid(year: number, month: number, sessions: { shown_at: string }[]): (DayCell | null)[][] {
  const countByDate: Record<string, number> = {};
  for (const s of sessions) {
    const d = s.shown_at.split('T')[0]!;
    countByDate[d] = (countByDate[d] ?? 0) + 1;
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ date: dateStr, count: countByDate[dateStr] ?? 0 });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (DayCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function calColor(count: number): string {
  if (count === 0) return 'hsl(220, 8%, 12%)';
  const ratio = Math.min(count / 12, 1);
  const sat = Math.round(15 + ratio * 75);
  const lit = Math.round(16 + ratio * 46);
  return `hsl(220, ${sat}%, ${lit}%)`;
}

const todayStr = () => new Date().toISOString().split('T')[0]!;

export default function DashboardPage() {
  const router = useRouter();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);

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
      const { data } = await api.get<{ data: QuizSession[] }>('/quiz/sessions?limit=500');
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

  const { data: allContent } = useQuery({
    queryKey: ['content'],
    queryFn: async (): Promise<Content[]> => {
      const { data } = await api.get<{ data: Content[] }>('/content');
      return data.data;
    },
  });

  const filteredContent = (allContent ?? []).filter(
    (c) =>
      (selectedTopicId === null || c.topic_id === selectedTopicId) &&
      (selectedGroupId === null || c.group_id === selectedGroupId),
  );

  // Unique groups present in topic-filtered content (before group filter is applied)
  const topicFilteredContent = (allContent ?? []).filter(
    (c) => selectedTopicId === null || c.topic_id === selectedTopicId,
  );
  const availableGroups = Array.from(
    new Map(
      topicFilteredContent
        .filter((c) => c.group_id !== null)
        .map((c) => [c.group_id!, { id: c.group_id!, name: c.group_name! }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const { data: nextQuestion } = useQuery({
    queryKey: ['next-question', selectedTopicId, selectedGroupId, selectedContentId],
    queryFn: async (): Promise<Question | null> => {
      const params = new URLSearchParams();
      if (selectedContentId) params.set('content_id', selectedContentId);
      else if (selectedGroupId) params.set('group_id', selectedGroupId);
      else if (selectedTopicId) params.set('topic_id', selectedTopicId);
      const qs = params.toString();
      const { data } = await api.get<{ data: Question[] }>(`/questions${qs ? `?${qs}` : ''}`);
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

  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [hoveredCell, setHoveredCell] = useState<DayCell | null>(null);
  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth();
  const isCurrentMonth = calYear === nowYear && calMonth === nowMonth;
  const goPrev = () => {
    setHoveredCell(null);
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  };
  const goNext = () => {
    setHoveredCell(null);
    if (!isCurrentMonth) {
      if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
      else setCalMonth((m) => m + 1);
    }
  };
  const monthGrid = useMemo(() => buildMonthGrid(calYear, calMonth, sessions ?? []), [calYear, calMonth, sessions]);

  const topicItems = [{ id: null as string | null, name: 'All' }, ...(topics ?? [])];
  const showGroupFilter = availableGroups.length > 1;
  const showContentFilter = filteredContent.length > 1;

  const selectTopic = (id: string | null) => {
    setSelectedTopicId(id);
    setSelectedGroupId(null);
    setSelectedContentId(null);
  };

  const selectGroup = (id: string | null) => {
    setSelectedGroupId(id);
    setSelectedContentId(null);
  };

  const startQuiz = () => {
    if (!nextQuestion) return;
    const params = new URLSearchParams({ id: nextQuestion.id });
    if (selectedContentId) params.set('contentId', selectedContentId);
    else if (selectedGroupId) params.set('groupId', selectedGroupId);
    else if (selectedTopicId) params.set('topicId', selectedTopicId);
    router.push(`/quiz?${params.toString()}`);
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
                    onClick={() => selectTopic(item.id)}
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

          {/* Group filter */}
          {showGroupFilter && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => selectGroup(null)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition ${
                  selectedGroupId === null
                    ? 'bg-[#0C1828] border-[#1A3460] text-[#5B8EF7]'
                    : 'bg-transparent border-[#222228] text-[#76769A] hover:border-[#38384A] hover:text-[#E8E8EC]'
                }`}
              >
                All groups
              </button>
              {availableGroups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => selectGroup(g.id)}
                  style={{ maxWidth: 200 }}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition truncate ${
                    selectedGroupId === g.id
                      ? 'bg-[#0C1828] border-[#1A3460] text-[#5B8EF7]'
                      : 'bg-transparent border-[#222228] text-[#76769A] hover:border-[#38384A] hover:text-[#E8E8EC]'
                  }`}
                >
                  📚 {g.name}
                </button>
              ))}
            </div>
          )}

          {/* Material filter */}
          {showContentFilter && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setSelectedContentId(null)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition ${
                  selectedContentId === null
                    ? 'bg-[#16161C] border-[#38384A] text-[#E8E8EC]'
                    : 'bg-transparent border-[#222228] text-[#76769A] hover:border-[#38384A] hover:text-[#E8E8EC]'
                }`}
              >
                All material
              </button>
              {filteredContent.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedContentId(c.id)}
                  style={{ maxWidth: 180 }}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition truncate ${
                    selectedContentId === c.id
                      ? 'bg-[#16161C] border-[#38384A] text-[#E8E8EC]'
                      : 'bg-transparent border-[#222228] text-[#76769A] hover:border-[#38384A] hover:text-[#E8E8EC]'
                  }`}
                >
                  {c.title}
                </button>
              ))}
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

          {/* Activity Calendar */}
          <div className="bg-[#131317] rounded-xl p-5 border border-[#222228]">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={goPrev}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#76769A] hover:text-[#E8E8EC] hover:bg-[#222228] transition text-lg leading-none"
              >
                ‹
              </button>
              <p className="text-xs font-semibold text-[#E8E8EC] transition-all duration-100 tabular-nums">
                {hoveredCell
                  ? `${hoveredCell.count} answered`
                  : `${CAL_MONTHS[calMonth]} ${calYear}`}
              </p>
              <button
                onClick={goNext}
                disabled={isCurrentMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#76769A] hover:text-[#E8E8EC] hover:bg-[#222228] disabled:opacity-30 transition text-lg leading-none"
              >
                ›
              </button>
            </div>
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-[3px] mb-[3px]">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="text-[10px] text-[#48486A] text-center pb-1">{d}</div>
              ))}
            </div>
            {/* Calendar rows */}
            {monthGrid.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7 gap-[3px] mb-[3px]">
                {row.map((cell, ci) => (
                  <div key={ci} className="aspect-square relative">
                    {cell && (
                      <div
                        className="absolute inset-0 rounded-[5px] flex items-center justify-center cursor-default transition-all duration-150 hover:scale-110 hover:brightness-125 hover:z-10"
                        style={{
                          backgroundColor: calColor(cell.count),
                          boxShadow: cell.date === today ? '0 0 0 1.5px #5B8EF7' : 'none',
                        }}
                        onMouseEnter={() => setHoveredCell(cell)}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <span style={{ fontSize: 11, lineHeight: 1, color: cell.count > 0 ? '#C8C8E0' : '#48486A' }}>
                          {parseInt(cell.date.slice(8))}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
