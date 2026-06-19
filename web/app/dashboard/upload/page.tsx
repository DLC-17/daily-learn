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
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data.data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['content'] });
      setTitle('');
      if (fileRef.current) fileRef.current.value = '';
      setSuccess(`Generated ${result.questionsGenerated} questions!`);
      setError('');
    },
    onError: (err) => { setError(extractErrorMsg(err, 'Upload failed')); setSuccess(''); },
  });

  const textMutation = useMutation({
    mutationFn: async (payload: { title: string; text: string }) => {
      const { data } = await api.post<{ data: { contentId: string; questionsGenerated: number } }>(
        '/content',
        payload,
      );
      return data.data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['content'] });
      setTitle('');
      setPastedText('');
      setSuccess(`Generated ${result.questionsGenerated} questions!`);
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
      <h1 className="text-3xl font-bold text-[#1E293B] mb-6">Upload Content</h1>

      <div className="flex gap-2 mb-4">
        {(['file', 'paste'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === tab
                ? 'bg-[#4F8EF7] text-white'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
            }`}
          >
            {tab === 'file' ? 'File' : 'Paste Text'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] mb-6">
        <input
          type="text"
          placeholder="Title (optional for file upload)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-[#1E293B] placeholder-[#64748B] outline-none focus:ring-2 focus:ring-[#4F8EF7] mb-3 transition text-base"
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
              className={`flex items-center justify-center w-full py-3 rounded-xl font-semibold text-white transition ${
                isBusy
                  ? 'bg-[#4F8EF7] opacity-60 cursor-not-allowed'
                  : 'bg-[#4F8EF7] hover:bg-[#2563EB] cursor-pointer'
              }`}
            >
              {isBusy ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing…
                </span>
              ) : (
                'Choose File (PDF, TXT, DOCX, MD)'
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
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-[#1E293B] placeholder-[#64748B] outline-none focus:ring-2 focus:ring-[#4F8EF7] resize-none mb-3 transition text-base"
            />
            <button
              type="submit"
              disabled={isBusy}
              className="w-full py-3 rounded-xl font-semibold text-white bg-[#4F8EF7] hover:bg-[#2563EB] transition disabled:opacity-60"
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

        {error && <p className="text-sm text-[#EF4444] mt-3">{error}</p>}
        {success && <p className="text-sm text-[#22C55E] mt-3 font-medium">{success}</p>}
      </div>

      <h2 className="text-base font-semibold text-[#1E293B] mb-3">Your Content</h2>

      {contentLoading ? (
        <div className="flex justify-center mt-8">
          <div className="w-6 h-6 border-2 border-[#4F8EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (contentList ?? []).length === 0 ? (
        <p className="text-sm text-[#64748B] text-center mt-8">
          No content yet. Upload something to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {(contentList ?? []).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-[#E2E8F0]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1E293B] truncate">{item.title}</p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {item.questions_generated} questions ·{' '}
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => {
                  if (window.confirm(`Delete "${item.title}"?`)) deleteMutation.mutate(item.id);
                }}
                className="ml-3 text-[#EF4444] hover:opacity-70 text-lg leading-none transition"
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
