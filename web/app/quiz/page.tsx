'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  source_text: string | null;
}

interface SessionResult { correct: boolean; explanation: string }

const FLAG_REASONS = [
  'Wrong answer',
  'Poor wording',
  'Off-topic',
  'Other',
] as const;

type FlagState = 'idle' | 'picking' | 'pending' | 'done';

function QuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';
  const topicId = searchParams.get('topicId');
  const groupId = searchParams.get('groupId');
  const contentId = searchParams.get('contentId');

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const [flagState, setFlagState] = useState<FlagState>('idle');

  const { data: question, isLoading, isError } = useQuery({
    queryKey: ['question', id],
    queryFn: async (): Promise<Question> => {
      const { data } = await api.get<{ data: Question }>(`/questions/${id}`);
      return data.data;
    },
    enabled: !!id,
  });

  const answerMutation = useMutation({
    mutationFn: async (payload: { question_id: string; answer_index: number }) => {
      const { data } = await api.post<{ data: SessionResult }>('/quiz/session', payload);
      return data.data;
    },
    onSuccess: async (data) => {
      setResult(data);
      setSourceExpanded(false);
      setFlagState('idle');
      try {
        const params = new URLSearchParams({ exclude: id });
        if (contentId) params.set('content_id', contentId);
        else if (groupId) params.set('group_id', groupId);
        else if (topicId) params.set('topic_id', topicId);
        const { data: qData } = await api.get<{ data: { id: string }[] }>(`/questions?${params.toString()}`);
        setNextId(qData.data[0]?.id ?? null);
      } catch {
        setNextId(null);
      }
    },
  });

  const flagMutation = useMutation({
    mutationFn: async (reason: string) => {
      await api.post(`/questions/${id}/flag`, { reason });
    },
    onSuccess: () => {
      setFlagState('done');
    },
  });

  const handleNext = () => {
    if (!nextId) return;
    setSelectedIndex(null);
    setResult(null);
    setNextId(null);
    setSourceExpanded(false);
    setFlagState('idle');
    const params = new URLSearchParams({ id: nextId });
    if (contentId) params.set('contentId', contentId);
    else if (groupId) params.set('groupId', groupId);
    else if (topicId) params.set('topicId', topicId);
    router.replace(`/quiz?${params.toString()}`);
  };

  const handleFlag = (reason: string) => {
    setFlagState('pending');
    flagMutation.mutate(reason);
  };

  const optionClass = (index: number) => {
    const base = 'flex items-start gap-3 p-4 rounded-xl border text-left transition w-full';
    if (!result) {
      return `${base} ${
        selectedIndex === index
          ? 'bg-[#0C1828] border-[#1A3460] cursor-pointer'
          : 'bg-[#131317] border-[#222228] hover:border-[#38384A] cursor-pointer'
      }`;
    }
    if (index === question?.correct_index) return `${base} bg-[#071610] border-[#143A20]`;
    if (index === selectedIndex && !result.correct) return `${base} bg-[#180808] border-[#3A1414]`;
    return `${base} bg-[#131317] border-[#222228]`;
  };

  const optionLabelClass = (index: number) => {
    if (!result) return selectedIndex === index ? 'text-[#5B8EF7]' : 'text-[#48486A]';
    if (index === question?.correct_index) return 'text-[#22C55E]';
    if (index === selectedIndex && !result.correct) return 'text-[#EF4444]';
    return 'text-[#48486A]';
  };

  const optionTextClass = (index: number) => {
    if (!result) return selectedIndex === index ? 'text-[#5B8EF7] font-medium' : 'text-[#E8E8EC]';
    if (index === question?.correct_index) return 'text-[#22C55E] font-medium';
    if (index === selectedIndex && !result.correct) return 'text-[#EF4444] font-medium';
    return 'text-[#48486A]';
  };

  if (!id || isLoading) {
    return (
      <div className="min-h-screen bg-[#09090C] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#5B8EF7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !question) {
    return (
      <div className="min-h-screen bg-[#09090C] flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-[#76769A]">Could not load question.</p>
        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl border border-[#222228] text-xs font-semibold text-[#E8E8EC] hover:bg-[#131317] transition"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090C] p-6 flex justify-center">
      <div className="w-full max-w-lg pt-4">
        <button
          onClick={() => router.back()}
          className="text-xs text-[#76769A] hover:text-[#E8E8EC] mb-8 flex items-center gap-1.5 transition"
        >
          ← Back
        </button>

        <p className="text-base font-semibold text-[#E8E8EC] leading-7 mb-6">
          {question.question_text}
        </p>

        <div className="flex flex-col gap-2 mb-5">
          {question.options.map((opt, index) => (
            <button
              key={index}
              className={optionClass(index)}
              onClick={() => { if (!result) setSelectedIndex(index); }}
              disabled={!!result}
            >
              <span className={`text-xs font-bold w-5 shrink-0 mt-0.5 ${optionLabelClass(index)}`}>
                {String.fromCharCode(65 + index)}.
              </span>
              <span className={`text-sm leading-snug ${optionTextClass(index)}`}>
                {opt}
              </span>
            </button>
          ))}
        </div>

        {result ? (
          <>
            <div
              className={`rounded-xl p-4 mb-3 border ${
                result.correct
                  ? 'bg-[#071610] border-[#143A20]'
                  : 'bg-[#180808] border-[#3A1414]'
              }`}
            >
              <p className={`text-xs font-bold mb-1 ${result.correct ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {result.correct ? '✓ Correct' : '✗ Incorrect'}
              </p>
              <p className="text-sm text-[#E8E8EC] leading-5">{result.explanation}</p>
            </div>

            {question.source_text && (
              <div className="bg-[#131317] rounded-xl border border-[#222228] mb-3 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5"
                  onClick={() => setSourceExpanded((v) => !v)}
                >
                  <span className="text-xs font-semibold text-[#48486A] uppercase tracking-wider">Source</span>
                  <span className="text-xs text-[#5B8EF7]">{sourceExpanded ? 'Hide' : 'Show'}</span>
                </button>
                {sourceExpanded && (
                  <div className="border-t border-[#222228] px-4 py-3">
                    <p className="text-xs text-[#76769A] leading-5">{question.source_text}</p>
                  </div>
                )}
              </div>
            )}

            {/* Flag section */}
            <div className="mb-3">
              {flagState === 'done' ? (
                <p className="text-xs text-[#76769A] text-center py-1">
                  Flagged — you can review it in{' '}
                  <a href="/dashboard/flagged" className="text-[#5B8EF7] hover:underline">Flagged Questions</a>.
                </p>
              ) : flagState === 'picking' ? (
                <div className="bg-[#131317] rounded-xl border border-[#222228] p-3">
                  <p className="text-xs text-[#76769A] mb-2">What's the issue?</p>
                  <div className="flex flex-col gap-1.5">
                    {FLAG_REASONS.map((reason) => (
                      <button
                        key={reason}
                        onClick={() => handleFlag(reason)}
                        disabled={flagMutation.isPending}
                        className="text-left px-3 py-2 rounded-lg text-xs text-[#E8E8EC] border border-[#222228] hover:border-[#38384A] hover:bg-[#1A1A20] transition"
                      >
                        {reason}
                      </button>
                    ))}
                    <button
                      onClick={() => setFlagState('idle')}
                      className="text-xs text-[#48486A] hover:text-[#76769A] pt-1 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setFlagState('picking')}
                  className="w-full text-xs text-[#48486A] hover:text-[#76769A] py-1 transition"
                >
                  Flag this question
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {nextId && (
                <button
                  onClick={handleNext}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#5B8EF7] hover:bg-[#3A6EDB] transition"
                >
                  Next Question
                </button>
              )}
              <button
                onClick={() => router.back()}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition ${
                  nextId
                    ? 'text-[#48486A] hover:text-[#76769A]'
                    : 'text-[#E8E8EC] bg-[#131317] border border-[#222228] hover:bg-[#1A1A20]'
                }`}
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => {
              if (selectedIndex !== null && question)
                answerMutation.mutate({ question_id: question.id, answer_index: selectedIndex });
            }}
            disabled={selectedIndex === null || answerMutation.isPending}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#5B8EF7] hover:bg-[#3A6EDB] transition disabled:opacity-30"
          >
            {answerMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting…
              </span>
            ) : (
              'Submit Answer'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090C] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#5B8EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <QuizContent />
    </Suspense>
  );
}
