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

  const { data: cards, isLoading, isFetching } = useQuery({
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

  const prev = () => { setCardIndex((i) => Math.max(0, i - 1)); setIsFlipped(false); };
  const next = () => { setCardIndex((i) => Math.min(total - 1, i + 1)); setIsFlipped(false); };

  const topicItems = [{ id: null as string | null, name: 'All' }, ...(topics ?? [])];

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-[#E8E8EC] tracking-tight">Flashcards</h1>
      </div>

      {/* Topic filter */}
      {topicItems.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 mb-6" style={{ scrollbarWidth: 'none' }}>
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

      {isLoading ? (
        <div className="flex justify-center mt-20">
          <div className="w-5 h-5 border-2 border-[#5B8EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-5 mt-16">
          <p className="text-sm text-[#76769A]">No flashcards yet for this topic.</p>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#5B8EF7] hover:bg-[#3A6EDB] transition disabled:opacity-40"
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
        <div className="flex flex-col gap-4">
          {/* Counter */}
          <p className="text-center text-xs text-[#76769A]">
            {cardIndex + 1} / {total}
          </p>

          {/* Flip card */}
          <div
            className="relative cursor-pointer select-none"
            style={{ perspective: '1200px', height: 260 }}
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
                className="absolute inset-0 bg-[#131317] rounded-xl border border-[#222228] flex flex-col items-center justify-center p-8"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <p className="text-xs font-semibold text-[#48486A] uppercase tracking-widest mb-5">Term</p>
                <p className="text-lg font-semibold text-[#E8E8EC] text-center leading-7">{card?.term}</p>
                <p className="text-xs text-[#48486A] mt-6">Click to reveal</p>
              </div>

              {/* Back — Definition */}
              <div
                className="absolute inset-0 bg-[#0C1828] rounded-xl border border-[#1A3460] flex flex-col items-center justify-center p-8"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <p className="text-xs font-semibold text-[#5B8EF7] uppercase tracking-widest mb-5">Definition</p>
                <p className="text-sm text-[#E8E8EC] text-center leading-6">{card?.definition}</p>
                {card?.source_title && (
                  <p className="text-xs text-[#48486A] mt-5 text-center">{card.source_title}</p>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={cardIndex === 0}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium text-[#76769A] border border-[#222228] hover:border-[#38384A] hover:text-[#E8E8EC] transition disabled:opacity-20"
            >
              ← Prev
            </button>
            <button
              onClick={next}
              disabled={cardIndex === total - 1}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium text-[#76769A] border border-[#222228] hover:border-[#38384A] hover:text-[#E8E8EC] transition disabled:opacity-20"
            >
              Next →
            </button>
          </div>

          {/* Regenerate */}
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || isFetching}
            className="w-full py-2.5 rounded-xl text-xs font-medium text-[#76769A] border border-[#222228] hover:border-[#38384A] hover:text-[#E8E8EC] transition disabled:opacity-30"
          >
            {generateMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-[#76769A] border-t-transparent rounded-full animate-spin" />
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
