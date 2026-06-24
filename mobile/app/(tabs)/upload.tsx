import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
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
  topic_id: string | null;
  topic_name: string | null;
}

interface Topic {
  id: string;
  name: string;
  content_count: number;
}

const fetchContent = async (): Promise<ContentItem[]> => {
  const { data } = await api.get<{ data: ContentItem[] }>('/content');
  return data.data;
};

const fetchTopics = async (): Promise<Topic[]> => {
  const { data } = await api.get<{ data: Topic[] }>('/topics');
  return data.data;
};

const extractErrorMsg = (err: unknown, fallback: string): string => {
  if (isAxiosError(err)) {
    return (
      (err.response?.data as { error?: { message?: string } })?.error?.message ?? fallback
    );
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
    topicSection: { gap: spacing.xs },
    topicLabel: { fontSize: fontSizes.sm, fontWeight: '600', color: c.textSecondary },
    topicRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    topicChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    topicChipActive: { borderColor: c.primary, backgroundColor: c.primary },
    topicChipText: { fontSize: fontSizes.xs, color: c.textSecondary, fontWeight: '500' },
    topicChipTextActive: { color: '#fff' },
    newTopicChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    newTopicChipText: { fontSize: fontSizes.xs, color: c.primary, fontWeight: '600' },
    newTopicRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
    newTopicInput: {
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
    newTopicSave: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: c.primary,
      borderRadius: borderRadius.md,
    },
    newTopicSaveText: { fontSize: fontSizes.sm, color: '#fff', fontWeight: '600' },
    button: {
      backgroundColor: c.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
    sectionTitle: { fontSize: fontSizes.md, fontWeight: '600', color: c.text, marginBottom: spacing.sm },
    loader: { marginTop: spacing.lg },
    contentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    contentInfo: { flex: 1 },
    contentTitle: { fontSize: fontSizes.md, color: c.text, fontWeight: '500' },
    contentMeta: { fontSize: fontSizes.xs, color: c.textSecondary, marginTop: 2 },
    topicBadge: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
      backgroundColor: c.primary + '22',
    },
    topicBadgeText: { fontSize: 10, color: c.primary, fontWeight: '600' },
    deleteButton: { padding: spacing.sm },
    deleteText: { color: c.error, fontSize: fontSizes.md },
    emptyText: { color: c.textSecondary, textAlign: 'center', marginTop: spacing.lg },
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
  const [title, setTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: contentList, isLoading: contentLoading } = useQuery({
    queryKey: ['content'],
    queryFn: fetchContent,
  });

  const { data: topics } = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
  });

  const createTopicMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<{ data: { id: string; name: string } }>('/topics', { name });
      return data.data;
    },
    onSuccess: (topic) => {
      void queryClient.invalidateQueries({ queryKey: ['topics'] });
      setSelectedTopicId(topic.id);
      setNewTopicName('');
      setShowNewTopic(false);
    },
    onError: () => Alert.alert('Error', 'Could not create topic'),
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post<{ data: { contentId: string; questionsGenerated: number } }>(
        '/content',
        formData,
      );
      return data.data;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['content'] });
      setTitle('');
      setSelectedTopicId(null);
      Alert.alert('Done', `Generated ${result.questionsGenerated} questions!`);
    },
    onError: (err) => Alert.alert('Upload Failed', extractErrorMsg(err, 'Upload failed')),
  });

  const textMutation = useMutation({
    mutationFn: async (payload: { title: string; text: string; topic_id?: string }) => {
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
      setSelectedTopicId(null);
      Alert.alert('Done', `Generated ${result.questionsGenerated} questions!`);
    },
    onError: (err) => Alert.alert('Upload Failed', extractErrorMsg(err, 'Upload failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/content/${id}`); },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['content'] }),
    onError: () => Alert.alert('Error', 'Could not delete content'),
  });

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

    if (file.name.toLowerCase().endsWith('.md')) {
      const raw = await FileSystem.readAsStringAsync(file.uri, { encoding: 'utf8' });
      textMutation.mutate({
        title: title.trim() || file.name,
        text: stripMarkdown(raw),
        ...(selectedTopicId ? { topic_id: selectedTopicId } : {}),
      });
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim() || file.name);
    if (selectedTopicId) formData.append('topic_id', selectedTopicId);
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType ?? 'application/octet-stream',
    } as unknown as Blob);
    uploadMutation.mutate(formData);
  };

  const handleTextSubmit = () => {
    if (!title.trim()) { Alert.alert('Missing title', 'Please enter a title.'); return; }
    if (!pastedText.trim()) { Alert.alert('Missing content', 'Please paste some text.'); return; }
    textMutation.mutate({
      title: title.trim(),
      text: pastedText.trim(),
      ...(selectedTopicId ? { topic_id: selectedTopicId } : {}),
    });
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

  const handleSaveNewTopic = () => {
    const name = newTopicName.trim();
    if (!name) return;
    createTopicMutation.mutate(name);
  };

  const isBusy = uploadMutation.isPending || textMutation.isPending;

  const progressAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isBusy) {
      progressAnim.setValue(0);
      animRef.current = Animated.timing(progressAnim, {
        toValue: 0.85,
        duration: 40_000,
        useNativeDriver: false,
      });
      animRef.current.start();
    } else {
      animRef.current?.stop();
      progressAnim.setValue(0);
    }
  }, [isBusy]);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.heading}>Upload Content</Text>

          <View style={styles.tabRow}>
            {(['file', 'paste'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab ? styles.tabActive : null]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab ? styles.tabTextActive : null]}>
                  {tab === 'file' ? 'File' : 'Paste Text'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Title (optional for file upload)"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            {/* Topic selector */}
            <View style={styles.topicSection}>
              <Text style={styles.topicLabel}>Topic (optional)</Text>
              <View style={styles.topicRow}>
                {(topics ?? []).map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.topicChip, selectedTopicId === t.id ? styles.topicChipActive : null]}
                    onPress={() => setSelectedTopicId(selectedTopicId === t.id ? null : t.id)}
                  >
                    <Text style={[styles.topicChipText, selectedTopicId === t.id ? styles.topicChipTextActive : null]}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {!showNewTopic && (
                  <TouchableOpacity style={styles.newTopicChip} onPress={() => setShowNewTopic(true)}>
                    <Text style={styles.newTopicChipText}>+ New</Text>
                  </TouchableOpacity>
                )}
              </View>
              {showNewTopic && (
                <View style={styles.newTopicRow}>
                  <TextInput
                    style={styles.newTopicInput}
                    placeholder="Topic name"
                    placeholderTextColor={colors.textSecondary}
                    value={newTopicName}
                    onChangeText={setNewTopicName}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSaveNewTopic}
                  />
                  <TouchableOpacity style={styles.newTopicSave} onPress={handleSaveNewTopic}>
                    <Text style={styles.newTopicSaveText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowNewTopic(false); setNewTopicName(''); }}>
                    <Text style={{ color: colors.textSecondary, paddingHorizontal: spacing.xs }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {activeTab === 'file' ? (
              <TouchableOpacity
                style={[styles.button, isBusy ? styles.buttonDisabled : null]}
                onPress={handleFilePick}
                disabled={isBusy}
              >
                <Text style={styles.buttonText}>Choose File (PDF, TXT, DOCX, MD)</Text>
              </TouchableOpacity>
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
                  onPress={handleTextSubmit}
                  disabled={isBusy}
                >
                  <Text style={styles.buttonText}>Generate Questions</Text>
                </TouchableOpacity>
              </>
            )}

            {isBusy && (
              <View style={styles.progressBox}>
                <Text style={styles.progressLabel}>Generating questions…</Text>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressSub}>This may take a minute for longer content.</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Your Content</Text>

          {contentLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (contentList ?? []).length === 0 ? (
            <Text style={styles.emptyText}>No content yet. Upload something to get started.</Text>
          ) : (
            (contentList ?? []).map((item) => (
              <View key={item.id} style={styles.contentRow}>
                <View style={styles.contentInfo}>
                  <Text style={styles.contentTitle} numberOfLines={1}>{item.title}</Text>
                  {item.topic_name && (
                    <View style={styles.topicBadge}>
                      <Text style={styles.topicBadgeText}>{item.topic_name}</Text>
                    </View>
                  )}
                  <Text style={styles.contentMeta}>
                    {item.questions_generated} questions ·{' '}
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => confirmDelete(item)}
                  style={styles.deleteButton}
                  accessibilityLabel={`Delete ${item.title}`}
                >
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}
