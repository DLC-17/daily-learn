'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface FlaggedQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  flag_reason: string | null;
  flagged_at: string;
  content_title: string;
  content_id: string;
}

export default function FlaggedPage() {
  const qc = useQueryClient();

  const { data: questions, isLoading } = useQuery({
    queryKey: ['flagged-questions'],
    queryFn: async (): Promise<FlaggedQuestion[]> => {
      const { data } = await api.get<{ data: FlaggedQuestion[] }>('/questions/flagged');
      return data.data;
    },
  });

  const unflagMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/questions/${id}/flag`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['flagged-questions'] });
      void qc.invalidateQueries({ queryKey: ['next-question'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/questions/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['flagged-questions'] });
      void qc.invalidateQueries({ queryKey: ['next-question'] });
    },
  });

  const isPending = (id: string) =>
    (unflagMutation.isPending && unflagMutation.variables === id) ||
    (deleteMutation.isPending && deleteMutation.variables === id);

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-[#E8E8EC] tracking-tight">Flagged Questions</h1>
        <p className="text-xs text-[#76769A] mt-1">
          Questions you've marked as problematic during quizzes. Unflag to return them to the pool or delete to remove permanently.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-20">
          <div className="w-5 h-5 border-2 border-[#5B8EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !questions || questions.length === 0 ? (
        <div className="flex flex-col items-center mt-20 gap-2">
          <p className="text-sm text-[#76769A]">No flagged questions.</p>
          <p className="text-xs text-[#48486A]">Use "Flag this question" during a quiz to report issues.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className="bg-[#131317] rounded-xl border border-[#222228] p-4"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <p className="text-sm text-[#E8E8EC] leading-6 flex-1">{q.question_text}</p>
                {q.flag_reason && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#180808] border border-[#3A1414] text-[#EF4444]">
                    {q.flag_reason}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1 mb-3">
                {q.options.map((opt, i) => (
                  <p
                    key={i}
                    className={`text-xs leading-5 ${
                      i === q.correct_index ? 'text-[#22C55E]' : 'text-[#48486A]'
                    }`}
                  >
                    {String.fromCharCode(65 + i)}. {opt}
                    {i === q.correct_index && (
                      <span className="ml-1.5 text-[10px] text-[#22C55E] opacity-70">← marked correct</span>
                    )}
                  </p>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[10px] text-[#48486A]">{q.content_title}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => unflagMutation.mutate(q.id)}
                    disabled={isPending(q.id)}
                    className="text-xs text-[#76769A] hover:text-[#E8E8EC] transition disabled:opacity-40"
                  >
                    Unflag
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(q.id)}
                    disabled={isPending(q.id)}
                    className="text-xs text-[#EF4444] hover:text-red-300 transition disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
