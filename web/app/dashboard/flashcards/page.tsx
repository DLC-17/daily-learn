'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface Topic { id: string; name: string }
interface Flashcard { id: string; term: string; definition: string; source_title: string | null }

export default function FlashcardsPage() {
  const qc = useQueryClient();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const { data: topics } = useQuery({
    queryKey: ['topics'],
    queryFn: async (): Promise<Topic[]> => {
      const { data } = await api.get<{ data: Topic[] }>('/topics');
      return data.data;
    },
  });

  const {
    data: cards,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['flashcards', selectedTopicId],
    queryFn: async (): Promise<Flashcard[]> => {
      const params = selectedTopicId ? `?topic_id=${selectedTopicId}` : '';
      const { data } = await api.get<{ data: Flashcard[] }>(`/flashcards${params}`);
      return data.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body = selectedTopicId ? { topic_id: selectedTopicId } : {};
      await api.post('/flashcards/generate', body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['flashcards', selectedTopicId] });
      setCardIndex(0);
      setIsFlipped(false);
    },
  });

  const card = cards?.[cardIndex] ?? null;
  const total = cards?.length ?? 0;

  const selectTopic = (id: string | null) => {
    setSelectedTopicId(id);
    setCardIndex(0);
    setIsFlipped(false);
  };

  const prev = () => {
    setCardIndex((i) => Math.max(0, i - 1));
    setIsFlipped(false);
  };

  const next = () => {
    setCardIndex((i) => Math.min(total - 1, i + 1));
    setIsFlipped(false);
  };

  const topicItems = [{ id: null as string | null, name: 'All' }, ...(topics ?? [])];

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-[#1E293B] mb-6">Flashcards</h1>

      {/* Topic filter */}
      {topicItems.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6" style={{ scrollbarWidth: 'none' }}>
          {topicItems.map((item) => {
            const active = selectedTopicId === item.id;
            return (
              <button
                key={item.id ?? 'all'}
                onClick={() => selectTopic(item.id)}
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

      {isLoading ? (
        <div className="flex justify-center mt-16">
          <div className="w-8 h-8 border-2 border-[#4F8EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-6 mt-12">
          <p className="text-[#64748B] text-center">No flashcards yet for this topic.</p>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-6 py-3 rounded-xl font-semibold text-white bg-[#4F8EF7] hover:bg-[#2563EB] transition disabled:opacity-40"
          >
            {generateMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating…
              </span>
            ) : (
              'Generate Flashcards'
            )}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Counter */}
          <p className="text-center text-sm text-[#64748B]">
            {cardIndex + 1} / {total}
          </p>

          {/* Flip card */}
          <div
            className="relative cursor-pointer select-none"
            style={{ perspective: '1200px', height: 240 }}
            onClick={() => setIsFlipped((v) => !v)}
          >
            <div
              style={{
                transformStyle: 'preserve-3d',
                transition: 'transform 0.35s ease',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                position: 'relative',
                width: '100%',
                height: '100%',
              }}
            >
              {/* Front — Term */}
              <div
                className="absolute inset-0 bg-white rounded-2xl border border-[#E2E8F0] flex flex-col items-center justify-center p-8 shadow-sm"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-4">Term</p>
                <p className="text-xl font-semibold text-[#1E293B] text-center leading-7">{card?.term}</p>
                <p className="text-xs text-[#94A3B8] mt-6">Tap to reveal definition</p>
              </div>

              {/* Back — Definition */}
              <div
                className="absolute inset-0 bg-[#EFF6FF] rounded-2xl border border-[#BFDBFE] flex flex-col items-center justify-center p-8 shadow-sm"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <p className="text-xs font-bold text-[#4F8EF7] uppercase tracking-wider mb-4">Definition</p>
                <p className="text-base text-[#1E293B] text-center leading-6">{card?.definition}</p>
                {card?.source_title && (
                  <p className="text-xs text-[#64748B] mt-4 text-center">{card.source_title}</p>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={prev}
              disabled={cardIndex === 0}
              className="flex-1 py-2.5 rounded-xl border-[1.5px] border-[#E2E8F0] text-sm font-semibold text-[#64748B] hover:border-[#4F8EF7] hover:text-[#4F8EF7] transition disabled:opacity-30"
            >
              ← Prev
            </button>
            <button
              onClick={next}
              disabled={cardIndex === total - 1}
              className="flex-1 py-2.5 rounded-xl border-[1.5px] border-[#E2E8F0] text-sm font-semibold text-[#64748B] hover:border-[#4F8EF7] hover:text-[#4F8EF7] transition disabled:opacity-30"
            >
              Next →
            </button>
          </div>

          {/* Regenerate */}
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || isFetching}
            className="w-full py-2.5 rounded-xl border-[1.5px] border-[#E2E8F0] text-sm font-semibold text-[#64748B] hover:border-[#4F8EF7] hover:text-[#4F8EF7] transition disabled:opacity-40"
          >
            {generateMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-[#4F8EF7] border-t-transparent rounded-full animate-spin" />
                Regenerating…
              </span>
            ) : (
              'Regenerate'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
