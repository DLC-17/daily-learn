'use client';

import { Suspense, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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

function QuizContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicId = searchParams.get('topicId');

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [sourceExpanded, setSourceExpanded] = useState(false);

  const { data: question, isLoading, isError } = useQuery({
    queryKey: ['question', id],
    queryFn: async (): Promise<Question> => {
      const { data } = await api.get<{ data: Question }>(`/questions/${id}`);
      return data.data;
    },
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: async (payload: { question_id: string; answer_index: number }) => {
      const { data } = await api.post<{ data: SessionResult }>('/quiz/session', payload);
      return data.data;
    },
    onSuccess: async (data) => {
      setResult(data);
      setSourceExpanded(false);
      try {
        const params = new URLSearchParams({ exclude: id });
        if (topicId) params.set('topic_id', topicId);
        const { data: qData } = await api.get<{ data: { id: string }[] }>(`/questions?${params.toString()}`);
        setNextId(qData.data[0]?.id ?? null);
      } catch {
        setNextId(null);
      }
    },
  });

  const handleNext = () => {
    if (!nextId) return;
    setSelectedIndex(null);
    setResult(null);
    setNextId(null);
    setSourceExpanded(false);
    const param = topicId ? `?topicId=${topicId}` : '';
    router.replace(`/quiz/${nextId}${param}`);
  };

  const optionClass = (index: number) => {
    const base = 'flex items-start gap-3 p-4 rounded-xl border-[1.5px] text-left transition w-full';
    if (!result) {
      return `${base} ${
        selectedIndex === index
          ? 'bg-white border-[#4F8EF7] cursor-pointer'
          : 'bg-white border-[#E2E8F0] hover:border-[#4F8EF7] cursor-pointer'
      }`;
    }
    if (index === question?.correct_index) return `${base} bg-[#F0FDF4] border-[#22C55E]`;
    if (index === selectedIndex && !result.correct) return `${base} bg-[#FEF2F2] border-[#EF4444]`;
    return `${base} bg-white border-[#E2E8F0]`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4F8EF7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !question) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-4">
        <p className="text-[#64748B]">Could not load question.</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-xl border-[1.5px] border-[#E2E8F0] text-sm font-semibold text-[#1E293B] hover:bg-[#F8FAFC] transition"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 flex justify-center">
      <div className="w-full max-w-lg">
        <button
          onClick={() => router.back()}
          className="text-sm text-[#64748B] hover:text-[#1E293B] mb-6 flex items-center gap-1 transition"
        >
          ← Back
        </button>

        <p className="text-lg font-semibold text-[#1E293B] leading-7 mb-6">
          {question.question_text}
        </p>

        <div className="flex flex-col gap-3 mb-6">
          {question.options.map((opt, index) => (
            <button
              key={index}
              className={optionClass(index)}
              onClick={() => { if (!result) setSelectedIndex(index); }}
              disabled={!!result}
            >
              <span className="text-sm font-bold text-[#4F8EF7] w-5 shrink-0 mt-px">
                {String.fromCharCode(65 + index)}.
              </span>
              <span
                className={`text-sm leading-snug ${
                  result &&
                  (index === question.correct_index || (index === selectedIndex && !result.correct))
                    ? 'text-[#1E293B] font-medium'
                    : selectedIndex === index
                    ? 'text-[#4F8EF7] font-medium'
                    : 'text-[#1E293B]'
                }`}
              >
                {opt}
              </span>
            </button>
          ))}
        </div>

        {result ? (
          <>
            <div
              className={`rounded-xl p-4 mb-4 border ${
                result.correct ? 'bg-[#F0FDF4] border-[#22C55E]' : 'bg-[#FEF2F2] border-[#EF4444]'
              }`}
            >
              <p className="font-bold text-[#1E293B] mb-1">
                {result.correct ? '✓ Correct!' : '✗ Incorrect'}
              </p>
              <p className="text-sm text-[#1E293B] leading-5">{result.explanation}</p>
            </div>

            {question.source_text && (
              <div className="bg-white rounded-xl border border-[#E2E8F0] mb-4 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 border-b border-[#E2E8F0]"
                  onClick={() => setSourceExpanded((v) => !v)}
                >
                  <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Source</span>
                  <span className="text-xs font-semibold text-[#4F8EF7]">{sourceExpanded ? 'Hide' : 'Show'}</span>
                </button>
                {sourceExpanded && (
                  <p className="text-sm text-[#1E293B] leading-5 p-4">{question.source_text}</p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {nextId && (
                <button
                  onClick={handleNext}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-[#4F8EF7] hover:bg-[#2563EB] transition"
                >
                  Next Question
                </button>
              )}
              <button
                onClick={() => router.back()}
                className={`w-full py-3 rounded-xl font-semibold transition ${
                  nextId
                    ? 'text-[#64748B] hover:text-[#1E293B]'
                    : 'text-[#1E293B] bg-white border-[1.5px] border-[#E2E8F0] hover:bg-[#F8FAFC]'
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
                mutation.mutate({ question_id: question.id, answer_index: selectedIndex });
            }}
            disabled={selectedIndex === null || mutation.isPending}
            className="w-full py-3 rounded-xl font-semibold text-white bg-[#4F8EF7] hover:bg-[#2563EB] transition disabled:opacity-40"
          >
            {mutation.isPending ? (
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
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#4F8EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <QuizContent />
    </Suspense>
  );
}
