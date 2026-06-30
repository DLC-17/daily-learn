import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import api from '../../services/api';
import { useColors } from '../../hooks/useColors';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { spacing, fontSizes, borderRadius } from '../../constants/theme';
import type { ColorPalette } from '../../constants/theme';

interface ContentItem {
  id: string;
  title: string;
  questions_generated: number;
  topic_id: string | null;
  topic_name: string | null;
}

const fetchContent = async (): Promise<ContentItem[]> => {
  const { data } = await api.get<{ data: ContentItem[] }>('/content');
  return data.data;
};

const createStyles = (c: ColorPalette) =>
  StyleSheet.create({
    scroll: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
    heading: { fontSize: fontSizes.xxl, fontWeight: 'bold', color: c.text, marginBottom: spacing.xs },
    subheading: { fontSize: fontSizes.sm, color: c.textSecondary, marginBottom: spacing.lg },
    controlRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    selectedCount: { fontSize: fontSizes.sm, color: c.textSecondary },
    selectAllText: { fontSize: fontSizes.sm, color: c.primary, fontWeight: '600' },
    groupHeader: {
      fontSize: fontSizes.xs,
      fontWeight: '700',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.md,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    itemSelected: { borderColor: c.primary },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: c.primary, borderColor: c.primary },
    checkmark: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 15 },
    itemInfo: { flex: 1 },
    itemTitle: { fontSize: fontSizes.md, color: c.text, fontWeight: '500' },
    itemMeta: { fontSize: fontSizes.xs, color: c.textSecondary, marginTop: 2 },
    notice: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginTop: spacing.md,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
    },
    noticeText: { flex: 1, fontSize: fontSizes.xs, color: c.textSecondary, lineHeight: 18 },
    footer: { marginTop: spacing.lg },
    generateButton: {
      backgroundColor: c.primary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    generateButtonDisabled: { opacity: 0.4 },
    generateButtonText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    emptyText: {
      fontSize: fontSizes.md,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    emptyButton: {
      backgroundColor: c.primary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },
    emptyButtonText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
  });

export default function CardsConfigScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: content, isLoading } = useQuery({
    queryKey: ['content'],
    queryFn: fetchContent,
  });

  useEffect(() => {
    if (content) setSelectedIds(new Set(content.map((item) => item.id)));
  }, [content]);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = (content?.length ?? 0) > 0 && content?.length === selectedIds.size;

  const toggleAll = useCallback(() => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(content?.map((item) => item.id) ?? []));
  }, [allSelected, content]);

  const grouped = useMemo(() => {
    if (!content) return [];
    const map = new Map<string, { topicName: string; items: ContentItem[] }>();
    for (const item of content) {
      const key = item.topic_id ?? '__none__';
      if (!map.has(key)) map.set(key, { topicName: item.topic_name ?? 'Uncategorized', items: [] });
      map.get(key)!.items.push(item);
    }
    const result: { topicName: string; items: ContentItem[] }[] = [];
    for (const [key, group] of map) {
      if (key !== '__none__') result.push(group);
    }
    const uncategorized = map.get('__none__');
    if (uncategorized) result.push(uncategorized);
    return result;
  }, [content]);

  const selectedCount = selectedIds.size;

  const handleGenerate = async () => {
    if (selectedIds.size === 0 || !content) return;
    setIsGenerating(true);
    try {
      const ids = [...selectedIds];
      const isAll = ids.length === content.length;
      const body = isAll ? {} : { content_ids: ids.join(',') };
      // Use a 5-minute timeout — generation loops over chunks with sleeps between them
      await api.post('/flashcards/generate', body, { timeout: 300_000 });
      void queryClient.invalidateQueries({ queryKey: ['flashcards'] });
      router.back();
    } catch (err) {
      const msg = isAxiosError(err)
        ? ((err.response?.data as { error?: { message?: string } })?.error?.message ?? err.message)
        : 'Something went wrong. Please try again.';
      Alert.alert('Generation failed', msg);
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenWrapper applyTopInset={false}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!content || content.length === 0) {
    return (
      <ScreenWrapper applyTopInset={false}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            No content yet. Upload notes or a PDF first to generate flashcards.
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.back()}>
            <Text style={styles.emptyButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper applyTopInset={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Choose Material</Text>
        <Text style={styles.subheading}>Select which content to turn into flashcards</Text>

        <View style={styles.controlRow}>
          <Text style={styles.selectedCount}>{selectedCount} of {content.length} selected</Text>
          <TouchableOpacity onPress={toggleAll}>
            <Text style={styles.selectAllText}>{allSelected ? 'Deselect All' : 'Select All'}</Text>
          </TouchableOpacity>
        </View>

        {grouped.map((group) => (
          <View key={group.topicName}>
            {grouped.length > 1 && (
              <Text style={styles.groupHeader}>{group.topicName}</Text>
            )}
            {group.items.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.item, isSelected ? styles.itemSelected : null]}
                  onPress={() => toggleItem(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, isSelected ? styles.checkboxChecked : null]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.itemMeta}>{item.questions_generated} questions</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Existing flashcards for selected content will be replaced with freshly generated ones.
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.generateButton,
              (selectedCount === 0 || isGenerating) ? styles.generateButtonDisabled : null,
            ]}
            onPress={() => void handleGenerate()}
            disabled={selectedCount === 0 || isGenerating}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={[styles.generateButtonText, { marginTop: spacing.xs }]}>
                  Generating… this may take a minute
                </Text>
              </>
            ) : (
              <Text style={styles.generateButtonText}>
                {selectedCount === 0 ? 'Select at least one item' : `Generate Flashcards`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
