import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import api from '../../services/api';
import { useColors } from '../../hooks/useColors';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { spacing, fontSizes, borderRadius } from '../../constants/theme';
import type { ColorPalette } from '../../constants/theme';

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

const extractErrorMsg = (err: unknown, fallback: string): string => {
  if (isAxiosError(err)) {
    return (err.response?.data as { error?: { message?: string } })?.error?.message ?? fallback;
  }
  return fallback;
};

const createStyles = (c: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
    heading: { fontSize: fontSizes.xl, fontWeight: 'bold', color: c.text, marginBottom: spacing.md },
    tabRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.sm },
    tab: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: borderRadius.md,
      backgroundColor: c.surface,
    },
    tabActive: { backgroundColor: c.primary },
    tabText: { fontSize: fontSizes.sm, color: c.textSecondary, fontWeight: '500' },
    tabTextActive: { color: '#fff' },
    formCard: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSizes.md,
      color: c.text,
      backgroundColor: c.background,
    },
    textArea: { height: 120 },
    // Group picker
    groupSection: { gap: spacing.xs },
    groupLabel: { fontSize: fontSizes.sm, fontWeight: '600', color: c.textSecondary },
    groupChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    groupChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    groupChipActive: { borderColor: c.primary, backgroundColor: c.primary },
    groupChipText: { fontSize: fontSizes.xs, color: c.textSecondary, fontWeight: '500' },
    groupChipTextActive: { color: '#fff' },
    newGroupChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    newGroupChipText: { fontSize: fontSizes.xs, color: c.primary, fontWeight: '600' },
    newGroupRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
    newGroupInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: fontSizes.sm,
      color: c.text,
      backgroundColor: c.background,
    },
    newGroupSave: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: c.primary,
      borderRadius: borderRadius.md,
    },
    newGroupSaveText: { fontSize: fontSizes.sm, color: '#fff', fontWeight: '600' },
    button: {
      backgroundColor: c.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
    buttonHint: { fontSize: fontSizes.xs, color: c.textSecondary, textAlign: 'center', marginTop: spacing.xs },
    // Groups management section
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sectionTitle: { fontSize: fontSizes.md, fontWeight: '600', color: c.text },
    sectionAction: { fontSize: fontSizes.sm, color: c.primary, fontWeight: '600' },
    groupError: { fontSize: fontSizes.xs, color: c.error, marginBottom: spacing.xs },
    createGroupRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    createGroupInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSizes.sm,
      color: c.text,
      backgroundColor: c.background,
    },
    createGroupBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: c.primary,
      borderRadius: borderRadius.md,
    },
    createGroupBtnText: { color: '#fff', fontSize: fontSizes.sm, fontWeight: '600' },
    cancelBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    cancelBtnText: { color: c.textSecondary, fontSize: fontSizes.sm },
    emptyGroupText: { fontSize: fontSizes.sm, color: c.textSecondary, marginBottom: spacing.lg },
    groupMgmtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.xs,
      gap: spacing.sm,
    },
    groupMgmtEmoji: { fontSize: fontSizes.md },
    groupMgmtName: { flex: 1, fontSize: fontSizes.md, color: c.text, fontWeight: '500' },
    groupMgmtCount: { fontSize: fontSizes.xs, color: c.textSecondary },
    groupMgmtEdit: { fontSize: fontSizes.xs, color: c.textSecondary, paddingHorizontal: spacing.xs },
    groupMgmtDel: { fontSize: fontSizes.xs, color: c.error, paddingHorizontal: spacing.xs },
    groupRenameInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: borderRadius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      fontSize: fontSizes.sm,
      color: c.text,
      backgroundColor: c.background,
    },
    groupSaveBtn: { fontSize: fontSizes.xs, color: c.primary, paddingHorizontal: spacing.xs, fontWeight: '600' },
    // Content list
    loader: { marginTop: spacing.lg },
    emptyText: { color: c.textSecondary, textAlign: 'center', marginTop: spacing.lg },
    accordionBlock: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: borderRadius.md,
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    accordionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      gap: spacing.sm,
    },
    accordionHeaderUngroup: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    accordionEmoji: { fontSize: fontSizes.sm },
    accordionTitle: { flex: 1, fontSize: fontSizes.md, fontWeight: '600', color: c.text },
    accordionSubtitle: { flex: 1, fontSize: fontSizes.sm, color: c.textSecondary },
    accordionCount: { fontSize: fontSizes.xs, color: c.textSecondary },
    accordionChevron: { fontSize: fontSizes.xs, color: c.textSecondary, marginLeft: spacing.xs },
    contentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      backgroundColor: c.background,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: spacing.sm,
    },
    contentInfo: { flex: 1 },
    contentTitle: { fontSize: fontSizes.sm, color: c.text, fontWeight: '500' },
    contentMeta: { fontSize: fontSizes.xs, color: c.textSecondary, marginTop: 2 },
    moveGroupBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    moveGroupBtnText: { fontSize: 11, color: c.textSecondary },
    deleteButton: { padding: spacing.xs },
    deleteText: { color: c.error, fontSize: fontSizes.md },
    progressBox: { gap: spacing.xs, marginTop: spacing.xs },
    progressLabel: { fontSize: fontSizes.sm, color: c.text, fontWeight: '500' },
    progressTrack: {
      height: 6,
      backgroundColor: c.border,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: c.primary, borderRadius: borderRadius.full },
    progressSub: { fontSize: fontSizes.xs, color: c.textSecondary },
  });

export default function UploadScreen() {
  const queryClient = useQueryClient();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Upload form
  const [title, setTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [activeTab, setActiveTab] = useState<'file' | 'photo' | 'paste'>('file');

  // Group picker in form
  const [uploadGroupId, setUploadGroupId] = useState<string | null>(null);
  const [showNewUploadGroup, setShowNewUploadGroup] = useState(false);
  const [newUploadGroupName, setNewUploadGroupName] = useState('');

  // Group management
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [groupError, setGroupError] = useState('');

  // Collapsed group IDs in content list
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

  // ── Queries ───────────────────────────────────────────────────────────────

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
    onSuccess: (g) => {
      invalidate();
      setCreatingGroup(false);
      setNewGroupName('');
      setGroupError('');
      // If created from form picker, select the new group
      if (showNewUploadGroup) {
        setUploadGroupId(g.id);
        setShowNewUploadGroup(false);
        setNewUploadGroupName('');
      }
    },
    onError: (err) => setGroupError(extractErrorMsg(err, 'Could not create group')),
  });

  const renameGroupMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await api.patch(`/groups/${id}`, { name });
    },
    onSuccess: () => {
      invalidate();
      setEditingGroupId(null);
      setEditingGroupName('');
      setGroupError('');
    },
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
    onError: () => Alert.alert('Error', 'Could not move content'),
  });

  // ── Upload mutations ──────────────────────────────────────────────────────

  const resolveUploadGroupId = async (): Promise<string | null> => {
    if (showNewUploadGroup) {
      const name = newUploadGroupName.trim();
      if (!name) return null;
      const g = await createGroupMutation.mutateAsync(name);
      return g.id;
    }
    return uploadGroupId;
  };

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post<{ data: { contentId: string; questionsGenerated: number } }>(
        '/content', formData,
      );
      return data.data;
    },
    onSuccess: (result) => {
      invalidate();
      setTitle('');
      Alert.alert('Done', `Generated ${result.questionsGenerated} questions!`);
    },
    onError: (err) => Alert.alert('Upload Failed', extractErrorMsg(err, 'Upload failed')),
  });

  const textMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const { data } = await api.post<{ data: { contentId: string; questionsGenerated: number } }>(
        '/content', payload,
      );
      return data.data;
    },
    onSuccess: (result) => {
      invalidate();
      setTitle('');
      setPastedText('');
      Alert.alert('Done', `Generated ${result.questionsGenerated} questions!`);
    },
    onError: (err) => Alert.alert('Upload Failed', extractErrorMsg(err, 'Upload failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/content/${id}`); },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['content'] }),
    onError: () => Alert.alert('Error', 'Could not delete content'),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleFilePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'text/plain',
        'text/markdown',
        'text/x-markdown',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    if (!file) return;
    let groupId: string | null = null;
    try { groupId = await resolveUploadGroupId(); } catch { Alert.alert('Error', 'Could not create group'); return; }

    if (file.name.toLowerCase().endsWith('.md')) {
      const raw = await FileSystem.readAsStringAsync(file.uri, { encoding: 'utf8' });
      const payload: Record<string, string> = { title: title.trim() || file.name, text: stripMarkdown(raw) };
      if (groupId) payload['group_id'] = groupId;
      textMutation.mutate(payload);
      return;
    }
    const formData = new FormData();
    formData.append('title', title.trim() || file.name);
    if (groupId) formData.append('group_id', groupId);
    formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as unknown as Blob);
    uploadMutation.mutate(formData);
  };

  const handlePhotoPick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    if (!file) return;
    let groupId: string | null = null;
    try { groupId = await resolveUploadGroupId(); } catch { Alert.alert('Error', 'Could not create group'); return; }

    const formData = new FormData();
    formData.append('title', title.trim() || file.name);
    if (groupId) formData.append('group_id', groupId);
    formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'image/jpeg' } as unknown as Blob);
    uploadMutation.mutate(formData);
  };

  const handleTextSubmit = async () => {
    if (!title.trim()) { Alert.alert('Missing title', 'Please enter a title.'); return; }
    if (!pastedText.trim()) { Alert.alert('Missing content', 'Please paste some text.'); return; }
    let groupId: string | null = null;
    try { groupId = await resolveUploadGroupId(); } catch { Alert.alert('Error', 'Could not create group'); return; }
    const payload: Record<string, string> = { title: title.trim(), text: pastedText.trim() };
    if (groupId) payload['group_id'] = groupId;
    textMutation.mutate(payload);
  };

  const confirmDelete = (item: ContentItem) => {
    Alert.alert(
      'Delete content?',
      `"${item.title}" and all its questions will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
      ],
    );
  };

  const confirmDeleteGroup = (g: Group) => {
    const msg = g.content_count > 0
      ? `Delete "${g.name}"? Its ${g.content_count} item${g.content_count !== 1 ? 's' : ''} will become ungrouped.`
      : `Delete "${g.name}"?`;
    Alert.alert('Delete group?', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteGroupMutation.mutate(g.id) },
    ]);
  };

  const confirmMoveGroup = (item: ContentItem) => {
    const options = [
      { text: 'No group', onPress: () => moveGroupMutation.mutate({ id: item.id, groupId: null }) },
      ...(groups ?? []).map((g) => ({
        text: g.name,
        onPress: () => moveGroupMutation.mutate({ id: item.id, groupId: g.id }),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ];
    Alert.alert(`Move "${item.title}"`, 'Select a group', options);
  };

  const isBusy = uploadMutation.isPending || textMutation.isPending;

  // ── Progress animation ────────────────────────────────────────────────────

  const [progressAnim] = useState(() => new Animated.Value(0));
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const progressWidth = useMemo(
    () => progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
    [progressAnim],
  );

  useEffect(() => {
    if (isBusy) {
      progressAnim.setValue(0);
      animRef.current = Animated.timing(progressAnim, { toValue: 0.85, duration: 40_000, useNativeDriver: false });
      animRef.current.start();
    } else {
      animRef.current?.stop();
      progressAnim.setValue(0);
    }
  }, [isBusy, progressAnim]);

  // ── Derived content grouping ──────────────────────────────────────────────

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
  const hasAnyGroups = groupedEntries.some((e) => e.groupId !== null);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.heading}>Upload Content</Text>

          {/* ── Tabs ──────────────────────────────────────────────────────── */}
          <View style={styles.tabRow}>
            {(['file', 'photo', 'paste'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab ? styles.tabActive : null]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab ? styles.tabTextActive : null]}>
                  {tab === 'file' ? 'File' : tab === 'photo' ? 'Photo' : 'Paste Text'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Form card ─────────────────────────────────────────────────── */}
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Title (optional for file/photo)"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            {/* Group picker */}
            <View style={styles.groupSection}>
              <Text style={styles.groupLabel}>Add to group</Text>
              <View style={styles.groupChipRow}>
                <TouchableOpacity
                  style={[styles.groupChip, uploadGroupId === null && !showNewUploadGroup ? styles.groupChipActive : null]}
                  onPress={() => { setUploadGroupId(null); setShowNewUploadGroup(false); }}
                >
                  <Text style={[styles.groupChipText, uploadGroupId === null && !showNewUploadGroup ? styles.groupChipTextActive : null]}>
                    No group
                  </Text>
                </TouchableOpacity>
                {(groups ?? []).map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.groupChip, uploadGroupId === g.id && !showNewUploadGroup ? styles.groupChipActive : null]}
                    onPress={() => { setUploadGroupId(g.id); setShowNewUploadGroup(false); }}
                  >
                    <Text style={[styles.groupChipText, uploadGroupId === g.id && !showNewUploadGroup ? styles.groupChipTextActive : null]}>
                      {g.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {!showNewUploadGroup && (
                  <TouchableOpacity style={styles.newGroupChip} onPress={() => { setShowNewUploadGroup(true); setUploadGroupId(null); }}>
                    <Text style={styles.newGroupChipText}>+ New</Text>
                  </TouchableOpacity>
                )}
              </View>
              {showNewUploadGroup && (
                <View style={styles.newGroupRow}>
                  <TextInput
                    style={styles.newGroupInput}
                    placeholder="Group name…"
                    placeholderTextColor={colors.textSecondary}
                    value={newUploadGroupName}
                    onChangeText={setNewUploadGroupName}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => { if (newUploadGroupName.trim()) createGroupMutation.mutate(newUploadGroupName.trim()); }}
                  />
                  <TouchableOpacity
                    style={styles.newGroupSave}
                    onPress={() => { if (newUploadGroupName.trim()) createGroupMutation.mutate(newUploadGroupName.trim()); }}
                    disabled={!newUploadGroupName.trim() || createGroupMutation.isPending}
                  >
                    <Text style={styles.newGroupSaveText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowNewUploadGroup(false); setNewUploadGroupName(''); }}>
                    <Text style={{ color: colors.textSecondary, paddingHorizontal: spacing.xs }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {activeTab === 'file' ? (
              <TouchableOpacity style={[styles.button, isBusy ? styles.buttonDisabled : null]} onPress={handleFilePick} disabled={isBusy}>
                <Text style={styles.buttonText}>
                  {isBusy ? 'Processing…' : 'Choose File — PDF, TXT, DOCX, MD'}
                </Text>
              </TouchableOpacity>
            ) : activeTab === 'photo' ? (
              <>
                <TouchableOpacity style={[styles.button, isBusy ? styles.buttonDisabled : null]} onPress={handlePhotoPick} disabled={isBusy}>
                  <Text style={styles.buttonText}>
                    {isBusy ? 'Processing…' : 'Choose Photo'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.buttonHint}>
                  Snap a textbook page, whiteboard, or handwritten notes — AI will extract the text
                </Text>
              </>
            ) : (
              <>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Paste your notes or article here…"
                  placeholderTextColor={colors.textSecondary}
                  value={pastedText}
                  onChangeText={setPastedText}
                  multiline
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[styles.button, isBusy ? styles.buttonDisabled : null]}
                  onPress={() => void handleTextSubmit()}
                  disabled={isBusy}
                >
                  <Text style={styles.buttonText}>
                    {isBusy ? 'Generating…' : 'Generate Questions'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {isBusy && (
              <View style={styles.progressBox}>
                <Text style={styles.progressLabel}>Generating questions…</Text>
                <View style={styles.progressTrack}>
                  <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
                </View>
                <Text style={styles.progressSub}>This may take a minute for longer content.</Text>
              </View>
            )}
          </View>

          {/* ── Groups management ─────────────────────────────────────────── */}
          <View style={{ marginBottom: spacing.lg }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Groups</Text>
              {!creatingGroup && (
                <TouchableOpacity onPress={() => { setCreatingGroup(true); setNewGroupName(''); setGroupError(''); }}>
                  <Text style={styles.sectionAction}>+ New group</Text>
                </TouchableOpacity>
              )}
            </View>

            {!!groupError && <Text style={styles.groupError}>{groupError}</Text>}

            {creatingGroup && (
              <View style={styles.createGroupRow}>
                <TextInput
                  style={styles.createGroupInput}
                  placeholder="Group name…"
                  placeholderTextColor={colors.textSecondary}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => { if (newGroupName.trim()) createGroupMutation.mutate(newGroupName.trim()); }}
                />
                <TouchableOpacity
                  style={styles.createGroupBtn}
                  onPress={() => { if (newGroupName.trim()) createGroupMutation.mutate(newGroupName.trim()); }}
                  disabled={!newGroupName.trim() || createGroupMutation.isPending}
                >
                  <Text style={styles.createGroupBtnText}>Create</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setCreatingGroup(false); setNewGroupName(''); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {(groups ?? []).length === 0 && !creatingGroup ? (
              <Text style={styles.emptyGroupText}>No groups yet. Create one to organise your content.</Text>
            ) : (
              (groups ?? []).map((g) => (
                <View key={g.id} style={styles.groupMgmtRow}>
                  <Text style={styles.groupMgmtEmoji}>📚</Text>
                  {editingGroupId === g.id ? (
                    <TextInput
                      style={styles.groupRenameInput}
                      value={editingGroupName}
                      onChangeText={setEditingGroupName}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => { if (editingGroupName.trim()) renameGroupMutation.mutate({ id: g.id, name: editingGroupName.trim() }); }}
                    />
                  ) : (
                    <Text style={styles.groupMgmtName} numberOfLines={1}>{g.name}</Text>
                  )}
                  <Text style={styles.groupMgmtCount}>{g.content_count} item{g.content_count !== 1 ? 's' : ''}</Text>
                  {editingGroupId === g.id ? (
                    <>
                      <TouchableOpacity onPress={() => { if (editingGroupName.trim()) renameGroupMutation.mutate({ id: g.id, name: editingGroupName.trim() }); }}>
                        <Text style={styles.groupSaveBtn}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setEditingGroupId(null); setEditingGroupName(''); }}>
                        <Text style={styles.groupMgmtEdit}>Cancel</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => { setEditingGroupId(g.id); setEditingGroupName(g.name); setGroupError(''); }}>
                        <Text style={styles.groupMgmtEdit}>Rename</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDeleteGroup(g)}>
                        <Text style={styles.groupMgmtDel}>Delete</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ))
            )}
          </View>

          {/* ── Content list ──────────────────────────────────────────────── */}
          <Text style={[styles.sectionTitle, { marginBottom: spacing.sm }]}>Your Content</Text>

          {contentLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (contentList ?? []).length === 0 ? (
            <Text style={styles.emptyText}>No content yet. Upload something to get started.</Text>
          ) : (
            groupedEntries.map(({ groupId, groupName, items }) => {
              const isGroup = groupId !== null;
              const isOpen = !isGroup || !collapsedGroups.has(groupId);

              return (
                <View key={groupId ?? '__ungrouped__'} style={styles.accordionBlock}>
                  {isGroup ? (
                    <TouchableOpacity style={styles.accordionHeader} onPress={() => toggleGroup(groupId)} activeOpacity={0.7}>
                      <Text style={styles.accordionEmoji}>📚</Text>
                      <Text style={styles.accordionTitle} numberOfLines={1}>{groupName}</Text>
                      <Text style={styles.accordionCount}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
                      <Text style={styles.accordionChevron}>{isOpen ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                  ) : hasAnyGroups ? (
                    <View style={styles.accordionHeaderUngroup}>
                      <Text style={styles.accordionSubtitle}>Ungrouped</Text>
                      <Text style={styles.accordionCount}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
                    </View>
                  ) : null}

                  {isOpen && items.map((item) => (
                    <View key={item.id} style={styles.contentItem}>
                      <View style={styles.contentInfo}>
                        <Text style={styles.contentTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.contentMeta}>
                          {item.questions_generated} questions · {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      {(groups ?? []).length > 0 && (
                        <TouchableOpacity style={styles.moveGroupBtn} onPress={() => confirmMoveGroup(item)}>
                          <Text style={styles.moveGroupBtnText}>
                            {item.group_name ?? 'Move'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteButton}>
                        <Text style={styles.deleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}
