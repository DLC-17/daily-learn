import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import api from '../../services/api';
import { colors, spacing, fontSizes, borderRadius } from '../../constants/theme';

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
}

const fetchContent = async (): Promise<ContentItem[]> => {
  const { data } = await api.get<{ data: ContentItem[] }>('/content');
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

export default function UploadScreen() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');

  const { data: contentList, isLoading: contentLoading } = useQuery({
    queryKey: ['content'],
    queryFn: fetchContent,
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
      Alert.alert('Done', `Generated ${result.questionsGenerated} questions!`);
    },
    onError: (err) => Alert.alert('Upload Failed', extractErrorMsg(err, 'Upload failed')),
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
      textMutation.mutate({ title: title.trim() || file.name, text: stripMarkdown(raw) });
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim() || file.name);
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
    textMutation.mutate({ title: title.trim(), text: pastedText.trim() });
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

  const isBusy = uploadMutation.isPending || textMutation.isPending;

  return (
    <View style={styles.container}>
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

        {activeTab === 'file' ? (
          <TouchableOpacity
            style={[styles.button, isBusy ? styles.buttonDisabled : null]}
            onPress={handleFilePick}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Choose File (PDF, TXT, DOCX, MD)</Text>
            )}
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
              {isBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Generate Questions</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>Your Content</Text>

      {contentLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={contentList ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.contentRow}>
              <View style={styles.contentInfo}>
                <Text style={styles.contentTitle} numberOfLines={1}>{item.title}</Text>
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
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No content yet. Upload something to get started.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  heading: {
    fontSize: fontSizes.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  tabRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.sm },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  textArea: { height: 120 },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
  sectionTitle: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  loader: { marginTop: spacing.lg },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  contentInfo: { flex: 1 },
  contentTitle: { fontSize: fontSizes.md, color: colors.text, fontWeight: '500' },
  contentMeta: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
  deleteButton: { padding: spacing.sm },
  deleteText: { color: colors.error, fontSize: fontSizes.md },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
