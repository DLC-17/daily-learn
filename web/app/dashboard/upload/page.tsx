'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import api from '@/lib/api';

interface ContentItem {
  id: string;
  title: string;
  file_name: string | null;
  created_at: string;
  questions_generated: number;
}

const stripMarkdown = (text: string): string =>
  text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]+`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/[*_]{1,2}([^*_\n]+)[*_]{1,2}/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^-{3,}$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const extractErrorMsg = (err: unknown, fallback: string): string =>
  isAxiosError(err)
    ? (err.response?.data as { error?: { message?: string } })?.error?.message ?? fallback
    : fallback;

export default function UploadPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [title, setTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: contentList, isLoading: contentLoading } = useQuery({
    queryKey: ['content'],
    queryFn: async (): Promise<ContentItem[]> => {
      const { data } = await api.get<{ data: ContentItem[] }>('/content');
      return data.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post<{ data: { contentId: string; questionsGenerated: number } }>(
        '/content',
        formData,
        { timeout: 300_000 },
      );
      return data.data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['content'] });
      setTitle('');
      if (fileRef.current) fileRef.current.value = '';
      setSuccess(`Generated ${result.questionsGenerated} questions`);
      setError('');
    },
    onError: (err) => { setError(extractErrorMsg(err, 'Upload failed')); setSuccess(''); },
  });

  const textMutation = useMutation({
    mutationFn: async (payload: { title: string; text: string }) => {
      const { data } = await api.post<{ data: { contentId: string; questionsGenerated: number } }>(
        '/content',
        payload,
        { timeout: 300_000 },
      );
      return data.data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['content'] });
      setTitle('');
      setPastedText('');
      setSuccess(`Generated ${result.questionsGenerated} questions`);
      setError('');
    },
    onError: (err) => { setError(extractErrorMsg(err, 'Upload failed')); setSuccess(''); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/content/${id}`); },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['content'] }),
    onError: () => setError('Could not delete content'),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setSuccess('');
    if (file.name.toLowerCase().endsWith('.md')) {
      const raw = await file.text();
      textMutation.mutate({ title: title.trim() || file.name, text: stripMarkdown(raw) });
      return;
    }
    const formData = new FormData();
    formData.append('title', title.trim() || file.name);
    formData.append('file', file);
    uploadMutation.mutate(formData);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Please enter a title.'); return; }
    if (!pastedText.trim()) { setError('Please paste some text.'); return; }
    setError('');
    textMutation.mutate({ title: title.trim(), text: pastedText.trim() });
  };

  const isBusy = uploadMutation.isPending || textMutation.isPending;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-[#E8E8EC] tracking-tight mb-8">Upload</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-[#131317] rounded-xl p-1 border border-[#222228]">
        {(['file', 'paste'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
              activeTab === tab
                ? 'bg-[#1A1A20] text-[#E8E8EC]'
                : 'text-[#76769A] hover:text-[#E8E8EC]'
            }`}
          >
            {tab === 'file' ? 'File' : 'Paste Text'}
          </button>
        ))}
      </div>

      <div className="bg-[#131317] rounded-xl p-5 border border-[#222228] mb-6">
        <input
          type="text"
          placeholder="Title (optional for file upload)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-[#09090C] border border-[#222228] rounded-xl px-4 py-3 text-[#E8E8EC] placeholder-[#48486A] outline-none focus:ring-1 focus:ring-[#5B8EF7] mb-3 transition text-sm"
        />

        {activeTab === 'file' ? (
          <>
            <input
              ref={fileRef}
              type="file"
              id="file-input"
              accept=".pdf,.txt,.docx,.md,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              disabled={isBusy}
              className="hidden"
            />
            <label
              htmlFor="file-input"
              className={`flex items-center justify-center w-full py-3 rounded-xl text-sm font-semibold text-white transition ${
                isBusy
                  ? 'bg-[#5B8EF7] opacity-40 cursor-not-allowed'
                  : 'bg-[#5B8EF7] hover:bg-[#3A6EDB] cursor-pointer'
              }`}
            >
              {isBusy ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing…
                </span>
              ) : (
                'Choose File — PDF, TXT, DOCX, MD'
              )}
            </label>
          </>
        ) : (
          <form onSubmit={handleTextSubmit}>
            <textarea
              placeholder="Paste your notes or article here…"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={6}
              className="w-full bg-[#09090C] border border-[#222228] rounded-xl px-4 py-3 text-[#E8E8EC] placeholder-[#48486A] outline-none focus:ring-1 focus:ring-[#5B8EF7] resize-none mb-3 transition text-sm"
            />
            <button
              type="submit"
              disabled={isBusy}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#5B8EF7] hover:bg-[#3A6EDB] transition disabled:opacity-40"
            >
              {isBusy ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating…
                </span>
              ) : (
                'Generate Questions'
              )}
            </button>
          </form>
        )}

        {error && <p className="text-xs text-[#EF4444] mt-3">{error}</p>}
        {success && <p className="text-xs text-[#22C55E] mt-3">{success}</p>}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[#76769A] uppercase tracking-wider">Your Content</p>
      </div>

      {contentLoading ? (
        <div className="flex justify-center mt-10">
          <div className="w-5 h-5 border-2 border-[#5B8EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (contentList ?? []).length === 0 ? (
        <p className="text-xs text-[#48486A] text-center mt-10">
          Nothing uploaded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {(contentList ?? []).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-[#131317] rounded-xl px-4 py-3 border border-[#222228]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#E8E8EC] truncate">{item.title}</p>
                <p className="text-xs text-[#76769A] mt-0.5">
                  {item.questions_generated} questions ·{' '}
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => {
                  if (window.confirm(`Delete "${item.title}"?`)) deleteMutation.mutate(item.id);
                }}
                className="ml-4 text-xs text-[#48486A] hover:text-[#EF4444] transition"
                aria-label={`Delete ${item.title}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
