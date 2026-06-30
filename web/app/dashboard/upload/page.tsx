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
  group_id: string | null;
  group_name: string | null;
}

interface Group { id: string; name: string; content_count: number }

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
  const fileRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [title, setTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  // 'none' | '' (no group) | a group id | '__new__'
  const [uploadGroupValue, setUploadGroupValue] = useState<string>('');
  const [uploadNewGroupName, setUploadNewGroupName] = useState('');

  // Group management state
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [groupError, setGroupError] = useState('');

  // Collapsed group IDs in the content list (empty = all expanded)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const expandGroup = (id: string) =>
    setCollapsedGroups((prev) => { const next = new Set(prev); next.delete(id); return next; });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['content'] });
    void queryClient.invalidateQueries({ queryKey: ['groups'] });
  };

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: contentList, isLoading: contentLoading } = useQuery({
    queryKey: ['content'],
    queryFn: async (): Promise<ContentItem[]> => {
      const { data } = await api.get<{ data: ContentItem[] }>('/content');
      return data.data;
    },
  });

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async (): Promise<Group[]> => {
      const { data } = await api.get<{ data: Group[] }>('/groups');
      return data.data;
    },
  });

  // ── Group mutations ───────────────────────────────────────────────────────

  const createGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<{ data: { id: string; name: string } }>('/groups', { name });
      return data.data;
    },
    onSuccess: () => { invalidate(); setCreatingGroup(false); setNewGroupName(''); setGroupError(''); },
    onError: (err) => setGroupError(extractErrorMsg(err, 'Could not create group')),
  });

  const renameGroupMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await api.patch(`/groups/${id}`, { name });
    },
    onSuccess: () => { invalidate(); setEditingGroupId(null); setEditingGroupName(''); setGroupError(''); },
    onError: (err) => setGroupError(extractErrorMsg(err, 'Could not rename group')),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/groups/${id}`); },
    onSuccess: () => { invalidate(); setGroupError(''); },
    onError: (err) => setGroupError(extractErrorMsg(err, 'Could not delete group')),
  });

  const moveGroupMutation = useMutation({
    mutationFn: async ({ id, groupId }: { id: string; groupId: string | null }) => {
      await api.patch(`/content/${id}`, { group_id: groupId });
    },
    onSuccess: (_, variables) => {
      invalidate();
      if (variables.groupId) expandGroup(variables.groupId);
    },
    onError: () => setUploadError('Could not move content'),
  });

  // ── Upload mutations ──────────────────────────────────────────────────────

  const resolveUploadGroupId = async (): Promise<string | null> => {
    if (!uploadGroupValue || uploadGroupValue === '') return null;
    if (uploadGroupValue === '__new__') {
      const name = uploadNewGroupName.trim();
      if (!name) return null;
      const g = await createGroupMutation.mutateAsync(name);
      setUploadNewGroupName('');
      setUploadGroupValue(g.id);
      return g.id;
    }
    return uploadGroupValue;
  };

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post<{ data: { contentId: string; questionsGenerated: number } }>(
        '/content', formData, { timeout: 300_000 },
      );
      return data.data;
    },
    onSuccess: (result) => {
      invalidate();
      setTitle('');
      if (fileRef.current) fileRef.current.value = '';
      setUploadSuccess(`Generated ${result.questionsGenerated} questions`);
      setUploadError('');
    },
    onError: (err) => { setUploadError(extractErrorMsg(err, 'Upload failed')); setUploadSuccess(''); },
  });

  const textMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const { data } = await api.post<{ data: { contentId: string; questionsGenerated: number } }>(
        '/content', payload, { timeout: 300_000 },
      );
      return data.data;
    },
    onSuccess: (result) => {
      invalidate();
      setTitle(''); setPastedText('');
      setUploadSuccess(`Generated ${result.questionsGenerated} questions`);
      setUploadError('');
    },
    onError: (err) => { setUploadError(extractErrorMsg(err, 'Upload failed')); setUploadSuccess(''); },
  });

  const deleteContentMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/content/${id}`); },
    onSuccess: () => invalidate(),
    onError: () => setUploadError('Could not delete content'),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(''); setUploadSuccess('');
    let groupId: string | null = null;
    try { groupId = await resolveUploadGroupId(); } catch { setUploadError('Could not create group'); return; }
    if (file.name.toLowerCase().endsWith('.md')) {
      const raw = await file.text();
      const payload: Record<string, string> = { title: title.trim() || file.name, text: stripMarkdown(raw) };
      if (groupId) payload['group_id'] = groupId;
      textMutation.mutate(payload);
      return;
    }
    const formData = new FormData();
    formData.append('title', title.trim() || file.name);
    formData.append('file', file);
    if (groupId) formData.append('group_id', groupId);
    uploadMutation.mutate(formData);
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setUploadError('Please enter a title.'); return; }
    if (!pastedText.trim()) { setUploadError('Please paste some text.'); return; }
    setUploadError('');
    let groupId: string | null = null;
    try { groupId = await resolveUploadGroupId(); } catch { setUploadError('Could not create group'); return; }
    const payload: Record<string, string> = { title: title.trim(), text: pastedText.trim() };
    if (groupId) payload['group_id'] = groupId;
    textMutation.mutate(payload);
  };

  const isBusy = uploadMutation.isPending || textMutation.isPending;

  // ── Derived display data ──────────────────────────────────────────────────

  const grouped = new Map<string | null, ContentItem[]>();
  for (const item of contentList ?? []) {
    const key = item.group_id ?? null;
    const arr = grouped.get(key) ?? [];
    arr.push(item);
    grouped.set(key, arr);
  }
  const groupedEntries: Array<{ groupId: string | null; groupName: string | null; items: ContentItem[] }> = [];
  for (const [gid, items] of grouped) {
    if (gid !== null) groupedEntries.push({ groupId: gid, groupName: items[0]!.group_name, items });
  }
  groupedEntries.sort((a, b) => (a.groupName ?? '').localeCompare(b.groupName ?? ''));
  const ungrouped = grouped.get(null) ?? [];
  if (ungrouped.length > 0) groupedEntries.push({ groupId: null, groupName: null, items: ungrouped });

  const inputCls = 'w-full bg-[#09090C] border border-[#222228] rounded-xl px-4 py-2.5 text-sm text-[#E8E8EC] placeholder-[#48486A] outline-none focus:ring-1 focus:ring-[#5B8EF7] transition';

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-[#E8E8EC] tracking-tight mb-8">Upload</h1>

      {/* ── Upload form ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-4 bg-[#131317] rounded-xl p-1 border border-[#222228]">
        {(['file', 'paste'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
              activeTab === tab ? 'bg-[#1A1A20] text-[#E8E8EC]' : 'text-[#76769A] hover:text-[#E8E8EC]'
            }`}
          >
            {tab === 'file' ? 'File' : 'Paste Text'}
          </button>
        ))}
      </div>

      <div className="bg-[#131317] rounded-xl p-5 border border-[#222228] mb-8">
        <input
          type="text"
          placeholder="Title (optional for file upload)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-[#09090C] border border-[#222228] rounded-xl px-4 py-3 text-[#E8E8EC] placeholder-[#48486A] outline-none focus:ring-1 focus:ring-[#5B8EF7] mb-3 transition text-sm"
        />

        {/* Group picker */}
        <div className="mb-3">
          <p className="text-xs text-[#76769A] mb-1.5">Add to group</p>
          <select
            value={uploadGroupValue}
            onChange={(e) => { setUploadGroupValue(e.target.value); setUploadNewGroupName(''); }}
            className="w-full bg-[#09090C] border border-[#222228] rounded-xl px-4 py-2.5 text-sm text-[#E8E8EC] outline-none focus:ring-1 focus:ring-[#5B8EF7] transition"
          >
            <option value="">No group</option>
            {(groups ?? []).map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
            <option value="__new__">+ Create new group…</option>
          </select>
          {uploadGroupValue === '__new__' && (
            <input
              type="text"
              placeholder="Group name, e.g. Campbell Biology 12th Ed."
              value={uploadNewGroupName}
              onChange={(e) => setUploadNewGroupName(e.target.value)}
              className={`${inputCls} mt-2`}
            />
          )}
        </div>

        {activeTab === 'file' ? (
          <>
            <input
              ref={fileRef}
              type="file"
              id="file-input"
              accept=".pdf,.txt,.docx,.md,.jpg,.jpeg,.png,.webp,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={isBusy}
              className="hidden"
            />
            <label
              htmlFor="file-input"
              className={`flex items-center justify-center w-full py-3 rounded-xl text-sm font-semibold text-white transition ${
                isBusy ? 'bg-[#5B8EF7] opacity-40 cursor-not-allowed' : 'bg-[#5B8EF7] hover:bg-[#3A6EDB] cursor-pointer'
              }`}
            >
              {isBusy ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing…
                </span>
              ) : 'Choose File — PDF, TXT, DOCX, MD, Photo'}
            </label>
            <p className="text-xs text-[#48486A] text-center mt-2">
              Snap a photo of a textbook page, whiteboard, or handwritten notes
            </p>
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
              ) : 'Generate Questions'}
            </button>
          </form>
        )}

        {uploadError && <p className="text-xs text-[#EF4444] mt-3">{uploadError}</p>}
        {uploadSuccess && <p className="text-xs text-[#22C55E] mt-3">{uploadSuccess}</p>}
      </div>

      {/* ── Groups management ────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[#76769A] uppercase tracking-wider">Groups</p>
          {!creatingGroup && (
            <button
              onClick={() => { setCreatingGroup(true); setNewGroupName(''); setGroupError(''); }}
              className="text-xs text-[#5B8EF7] hover:text-[#3A6EDB] transition"
            >
              + New group
            </button>
          )}
        </div>

        {groupError && <p className="text-xs text-[#EF4444] mb-2">{groupError}</p>}

        {/* Inline create row */}
        {creatingGroup && (
          <div className="flex items-center gap-2 mb-2">
            <input
              autoFocus
              type="text"
              placeholder="Group name…"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newGroupName.trim()) createGroupMutation.mutate(newGroupName.trim());
                if (e.key === 'Escape') { setCreatingGroup(false); setNewGroupName(''); }
              }}
              className="flex-1 bg-[#09090C] border border-[#1A3460] rounded-xl px-3 py-2 text-sm text-[#E8E8EC] placeholder-[#48486A] outline-none focus:ring-1 focus:ring-[#5B8EF7] transition"
            />
            <button
              onClick={() => { if (newGroupName.trim()) createGroupMutation.mutate(newGroupName.trim()); }}
              disabled={!newGroupName.trim() || createGroupMutation.isPending}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-[#5B8EF7] hover:bg-[#3A6EDB] transition disabled:opacity-40"
            >
              Create
            </button>
            <button
              onClick={() => { setCreatingGroup(false); setNewGroupName(''); }}
              className="px-3 py-2 rounded-xl text-xs text-[#76769A] hover:text-[#E8E8EC] border border-[#222228] hover:border-[#38384A] transition"
            >
              Cancel
            </button>
          </div>
        )}

        {(groups ?? []).length === 0 && !creatingGroup ? (
          <p className="text-xs text-[#48486A]">No groups yet. Create one to organise your content.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {(groups ?? []).map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-3 bg-[#131317] rounded-xl px-4 py-3 border border-[#222228]"
              >
                <span className="text-sm text-[#48486A]">📚</span>

                {editingGroupId === g.id ? (
                  <input
                    autoFocus
                    value={editingGroupName}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editingGroupName.trim())
                        renameGroupMutation.mutate({ id: g.id, name: editingGroupName.trim() });
                      if (e.key === 'Escape') { setEditingGroupId(null); setEditingGroupName(''); }
                    }}
                    className="flex-1 bg-[#09090C] border border-[#1A3460] rounded-lg px-3 py-1 text-sm text-[#E8E8EC] outline-none focus:ring-1 focus:ring-[#5B8EF7] transition"
                  />
                ) : (
                  <span className="flex-1 text-sm font-medium text-[#E8E8EC] truncate">{g.name}</span>
                )}

                <span className="text-xs text-[#48486A] shrink-0">{g.content_count} item{g.content_count !== 1 ? 's' : ''}</span>

                {editingGroupId === g.id ? (
                  <>
                    <button
                      onClick={() => { if (editingGroupName.trim()) renameGroupMutation.mutate({ id: g.id, name: editingGroupName.trim() }); }}
                      disabled={!editingGroupName.trim() || renameGroupMutation.isPending}
                      className="text-xs text-[#5B8EF7] hover:text-[#3A6EDB] transition disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingGroupId(null); setEditingGroupName(''); }}
                      className="text-xs text-[#76769A] hover:text-[#E8E8EC] transition"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditingGroupId(g.id); setEditingGroupName(g.name); setGroupError(''); }}
                      className="text-xs text-[#76769A] hover:text-[#E8E8EC] transition"
                      aria-label={`Rename ${g.name}`}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        const msg = g.content_count > 0
                          ? `Delete "${g.name}"? Its ${g.content_count} item${g.content_count !== 1 ? 's' : ''} will become ungrouped.`
                          : `Delete "${g.name}"?`;
                        if (window.confirm(msg)) deleteGroupMutation.mutate(g.id);
                      }}
                      disabled={deleteGroupMutation.isPending && deleteGroupMutation.variables === g.id}
                      className="text-xs text-[#48486A] hover:text-[#EF4444] transition disabled:opacity-40"
                      aria-label={`Delete ${g.name}`}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Content list ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[#76769A] uppercase tracking-wider">Your Content</p>
      </div>

      {contentLoading ? (
        <div className="flex justify-center mt-10">
          <div className="w-5 h-5 border-2 border-[#5B8EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (contentList ?? []).length === 0 ? (
        <p className="text-xs text-[#48486A] text-center mt-10">Nothing uploaded yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {groupedEntries.map(({ groupId, groupName, items }) => {
            const isGroup = groupId !== null;
            const isOpen = !isGroup || !collapsedGroups.has(groupId);
            const hasOtherGroups = groupedEntries.some((e) => e.groupId !== null);

            return (
              <div key={groupId ?? '__ungrouped__'} className="rounded-xl border border-[#222228] overflow-hidden">
                {/* Header — clickable for groups, plain label for ungrouped */}
                {isGroup ? (
                  <button
                    onClick={() => toggleGroup(groupId)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 bg-[#131317] hover:bg-[#1A1A20] transition text-left"
                  >
                    <span className="text-sm leading-none">📚</span>
                    <span className="flex-1 text-sm font-medium text-[#E8E8EC] truncate">{groupName}</span>
                    <span className="text-xs text-[#48486A] shrink-0">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    <span className="text-xs text-[#48486A] ml-1">{isOpen ? '▲' : '▼'}</span>
                  </button>
                ) : hasOtherGroups ? (
                  <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#131317]">
                    <span className="flex-1 text-xs text-[#48486A]">Ungrouped</span>
                    <span className="text-xs text-[#48486A]">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  </div>
                ) : null}

                {/* Items */}
                {isOpen && (
                  <div className={`flex flex-col ${isGroup ? 'border-t border-[#1A1A20]' : ''}`}>
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 px-4 py-3 bg-[#0D0D11] ${idx < items.length - 1 ? 'border-b border-[#1A1A20]' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#E8E8EC] truncate">{item.title}</p>
                          <p className="text-xs text-[#76769A] mt-0.5">
                            {item.questions_generated} questions · {new Date(item.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        <select
                          value={item.group_id ?? ''}
                          disabled={moveGroupMutation.isPending && moveGroupMutation.variables?.id === item.id}
                          onChange={(e) => moveGroupMutation.mutate({ id: item.id, groupId: e.target.value || null })}
                          className="shrink-0 bg-[#131317] border border-[#222228] rounded-lg px-2 py-1 text-xs text-[#76769A] outline-none focus:ring-1 focus:ring-[#5B8EF7] transition"
                          style={{ maxWidth: 150 }}
                        >
                          <option value="">No group</option>
                          {(groups ?? []).map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => {
                            if (window.confirm(`Delete "${item.title}"?`)) deleteContentMutation.mutate(item.id);
                          }}
                          className="shrink-0 text-xs text-[#48486A] hover:text-[#EF4444] transition"
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
          })}
        </div>
      )}
    </div>
  );
}
