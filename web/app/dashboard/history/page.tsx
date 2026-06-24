'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface Session {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  answer_index: number;
  is_correct: boolean;
  shown_at: string;
  content_id: string;
  content_title: string;
}

interface ContentGroup {
  contentId: string;
  contentTitle: string;
  sessions: Session[];
  correct: number;
}

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const groupByContent = (sessions: Session[]): ContentGroup[] => {
  const map = new Map<string, ContentGroup>();
  for (const s of sessions) {
    const existing = map.get(s.content_id);
    if (existing) {
      existing.sessions.push(s);
      if (s.is_correct) existing.correct++;
    } else {
      map.set(s.content_id, {
        contentId: s.content_id,
        contentTitle: s.content_title,
        sessions: [s],
        correct: s.is_correct ? 1 : 0,
      });
    }
  }
  return Array.from(map.values());
};

const buildPdfHtml = (groups: ContentGroup[]): string => {
  const groupsHtml = groups
    .map((group) => {
      const pct = Math.round((group.correct / group.sessions.length) * 100);
      const questionsHtml = group.sessions
        .map((s, qi) => {
          const optionsHtml = s.options
            .map((opt, oi) => {
              const isCorrect = oi === s.correct_index;
              const isChosen = oi === s.answer_index;
              const cls = isCorrect ? 'correct' : isChosen && !s.is_correct ? 'wrong' : 'option';
              const mark = isCorrect ? '✓ ' : isChosen && !s.is_correct ? '✗ ' : '';
              return `<div class="${cls}">${mark}${opt}</div>`;
            })
            .join('');
          return `<div class="question">
            <div class="q-num">Q${qi + 1}</div>
            <div class="q-text">${s.question_text}</div>
            <div class="options">${optionsHtml}</div>
            <div class="meta">${formatDate(s.shown_at)} · ${s.is_correct ? '<span class="badge-correct">Correct</span>' : '<span class="badge-wrong">Incorrect</span>'}</div>
          </div>`;
        })
        .join('');
      return `<div class="topic">
        <h2>${group.contentTitle}</h2>
        <div class="topic-meta">${group.correct}/${group.sessions.length} correct · ${pct}%</div>
        ${questionsHtml}
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Daily Learn — Quiz History</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #1E293B; }
  h1 { color: #4F8EF7; font-size: 24px; margin-bottom: 4px; }
  .export-date { color: #64748B; font-size: 13px; margin-bottom: 32px; }
  .topic { margin-bottom: 40px; }
  h2 { color: #1E293B; font-size: 18px; margin-bottom: 4px; border-bottom: 2px solid #4F8EF7; padding-bottom: 6px; }
  .topic-meta { color: #64748B; font-size: 13px; margin-bottom: 16px; }
  .question { margin-bottom: 20px; padding: 12px; border: 1px solid #E2E8F0; border-radius: 8px; }
  .q-num { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .q-text { font-weight: 600; margin-bottom: 10px; line-height: 1.4; }
  .options { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
  .option { padding: 6px 10px; border-radius: 4px; font-size: 14px; }
  .correct { padding: 6px 10px; border-radius: 4px; font-size: 14px; background: #F0FDF4; border-left: 3px solid #22C55E; }
  .wrong { padding: 6px 10px; border-radius: 4px; font-size: 14px; background: #FEF2F2; border-left: 3px solid #EF4444; }
  .meta { font-size: 12px; color: #64748B; }
  .badge-correct { color: #15803D; font-weight: 600; }
  .badge-wrong { color: #B91C1C; font-weight: 600; }
</style>
</head>
<body>
  <h1>Daily Learn — Quiz History</h1>
  <div class="export-date">Exported ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  ${groupsHtml}
</body>
</html>`;
};

export default function HistoryPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: sessions, isLoading, refetch } = useQuery({
    queryKey: ['sessions-history'],
    queryFn: async (): Promise<Session[]> => {
      const { data } = await api.get<{ data: Session[] }>('/quiz/sessions?limit=500');
      return data.data;
    },
  });

  const groups = groupByContent(sessions ?? []);
  const total = sessions?.length ?? 0;
  const correct = (sessions ?? []).filter((s) => s.is_correct).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const toggleExpand = (contentId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) next.delete(contentId);
      else next.add(contentId);
      return next;
    });
  };

  const handleExport = () => {
    if (groups.length === 0) return;
    const html = buildPdfHtml(groups);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-[#1E293B]">History</h1>
        <div className="flex gap-3 items-center">
          <button
            onClick={handleExport}
            disabled={total === 0}
            className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#4F8EF7] bg-white border-[1.5px] border-[#E2E8F0] hover:border-[#4F8EF7] transition disabled:opacity-40"
          >
            Export PDF
          </button>
          <button onClick={() => void refetch()} className="text-sm text-[#4F8EF7] hover:underline">
            Refresh
          </button>
        </div>
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
      ) : groups.length === 0 ? (
        <div className="text-center mt-16">
          <p className="text-lg font-semibold text-[#1E293B] mb-2">No quiz sessions yet.</p>
          <p className="text-sm text-[#64748B]">Answer questions to see your history here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => {
            const isOpen = expanded.has(group.contentId);
            const pct = Math.round((group.correct / group.sessions.length) * 100);
            return (
              <div key={group.contentId} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                <button
                  className="w-full flex items-center px-4 py-3 text-left hover:bg-[#F8FAFC] transition"
                  onClick={() => toggleExpand(group.contentId)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1E293B] truncate">{group.contentTitle}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {group.correct}/{group.sessions.length} correct · {pct}%
                    </p>
                  </div>
                  <span className="text-xs text-[#64748B] ml-3">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-[#E2E8F0]">
                    {group.sessions.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-start gap-3 px-4 py-3 border-b border-[#E2E8F0] last:border-b-0"
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold ${
                            s.is_correct ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'
                          }`}
                        >
                          {s.is_correct ? '✓' : '✗'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#1E293B] leading-5 mb-1">{s.question_text}</p>
                          {!s.is_correct && s.options.length > 0 && (
                            <div className="text-xs text-[#EF4444] leading-4 mb-1">
                              <span>Your answer: {s.options[s.answer_index] ?? '—'}</span>
                              <br />
                              <span>Correct: {s.options[s.correct_index] ?? '—'}</span>
                            </div>
                          )}
                          <p className="text-xs text-[#64748B]">{formatDate(s.shown_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
