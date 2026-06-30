'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface Topic { id: string; name: string }
interface Content { id: string; title: string; topic_id: string | null }
interface Content { id: string; title: string; topic_id: string | null; group_id: string | null; group_name: string | null }
interface Flashcard { id: string; term: string; definition: string; content_title: string | null }

export default function FlashcardsPage() {
  const qc = useQueryClient();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

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

  const filteredContent = topicFilteredContent.filter(
    (c) => selectedGroupId === null || c.group_id === selectedGroupId,
  );

  const { data: cards, isLoading, isFetching } = useQuery({
    queryKey: ['flashcards', selectedTopicId, selectedGroupId, selectedContentId],
    queryFn: async (): Promise<Flashcard[]> => {
      const params = new URLSearchParams();
      if (selectedContentId) params.set('content_id', selectedContentId);
      else if (selectedGroupId) params.set('group_id', selectedGroupId);
      else if (selectedTopicId) params.set('topic_id', selectedTopicId);
      const qs = params.toString();
      const { data } = await api.get<{ data: Flashcard[] }>(`/flashcards${qs ? `?${qs}` : ''}`);
      return data.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (selectedContentId) body['content_id'] = selectedContentId;
      else if (selectedGroupId) body['group_id'] = selectedGroupId;
      else if (selectedTopicId) body['topic_id'] = selectedTopicId;
      await api.post('/flashcards/generate', body);
    },
    onSuccess: () => {
      setGenerateError(null);
      void qc.invalidateQueries({ queryKey: ['flashcards', selectedTopicId, selectedGroupId, selectedContentId] });
      setCardIndex(0);
      setIsFlipped(false);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Generation failed. Make sure you have uploaded content first.';
      setGenerateError(msg);
    },
  });

  const card = cards?.[cardIndex] ?? null;
  const total = cards?.length ?? 0;

  const selectTopic = (id: string | null) => {
    setSelectedTopicId(id);
    setSelectedGroupId(null);
    setSelectedContentId(null);
    setCardIndex(0);
    setIsFlipped(false);
    setGenerateError(null);
  };

  const selectGroup = (id: string | null) => {
    setSelectedGroupId(id);
    setSelectedContentId(null);
    setCardIndex(0);
    setIsFlipped(false);
    setGenerateError(null);
  };

  const selectContent = (id: string | null) => {
    setSelectedContentId(id);
    setCardIndex(0);
    setIsFlipped(false);
    setGenerateError(null);
  };

  const prev = () => { setCardIndex((i) => Math.max(0, i - 1)); setIsFlipped(false); };
  const next = () => { setCardIndex((i) => Math.min(total - 1, i + 1)); setIsFlipped(false); };

  const topicItems = [{ id: null as string | null, name: 'All' }, ...(topics ?? [])];
  const showGroupFilter = availableGroups.length > 1;
  const showContentFilter = filteredContent.length > 1;

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-[#E8E8EC] tracking-tight">Flashcards</h1>
      </div>

      {/* Topic filter */}
      {topicItems.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 mb-2" style={{ scrollbarWidth: 'none' }}>
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
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 mb-2" style={{ scrollbarWidth: 'none' }}>
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
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 mb-6" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => selectContent(null)}
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
              onClick={() => selectContent(c.id)}
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

      {isLoading ? (
        <div className="flex justify-center mt-20">
          <div className="w-5 h-5 border-2 border-[#5B8EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-5 mt-16">
          <p className="text-sm text-[#76769A]">No flashcards yet for this selection.</p>
          {generateError && (
            <p className="text-xs text-red-400 text-center max-w-xs">{generateError}</p>
          )}
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
                {card?.content_title && (
                  <p className="text-xs text-[#48486A] mt-5 text-center">{card.content_title}</p>
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
          {generateError && (
            <p className="text-xs text-red-400 text-center">{generateError}</p>
          )}
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
