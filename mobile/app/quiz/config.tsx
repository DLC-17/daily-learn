import { useState, useMemo, useCallback } from 'react';
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
import { useQuery } from '@tanstack/react-query';
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
    footer: { marginTop: spacing.lg },
    beginButton: {
      backgroundColor: c.primary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    beginButtonDisabled: { opacity: 0.4 },
    beginButtonText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    emptyText: { fontSize: fontSizes.md, color: c.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
    emptyButton: {
      backgroundColor: c.primary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },
    emptyButtonText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
  });

export default function QuizConfigScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());
  const [isStarting, setIsStarting] = useState(false);

  const { data: content, isLoading } = useQuery({
    queryKey: ['content'],
    queryFn: fetchContent,
  });

  const selectedIds = useMemo(
    () => new Set((content ?? []).map((item) => item.id).filter((id) => !deselectedIds.has(id))),
    [content, deselectedIds],
  );

  const allSelected = (content?.length ?? 0) > 0 && deselectedIds.size === 0;

  const toggleItem = useCallback((id: string) => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) setDeselectedIds(new Set((content ?? []).map((item) => item.id)));
    else setDeselectedIds(new Set());
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
  const totalQuestions = (content ?? [])
    .filter((item) => selectedIds.has(item.id))
    .reduce((sum, item) => sum + item.questions_generated, 0);

  const handleBeginQuiz = async () => {
    if (selectedIds.size === 0 || !content) return;
    setIsStarting(true);
    try {
      const ids = [...selectedIds];
      const { data } = await api.get<{ data: { id: string }[] }>(
        `/questions?content_ids=${ids.join(',')}`,
      );
      const firstId = data.data[0]?.id;
      if (!firstId) {
        Alert.alert('No questions', 'No questions found for the selected content.');
        setIsStarting(false);
        return;
      }
      router.push({
        pathname: '/quiz/[id]',
        params: { id: firstId, contentIds: ids.join(',') },
      });
    } catch {
      setIsStarting(false);
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
            No content yet. Upload notes or a PDF first to generate questions.
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
        <Text style={styles.subheading}>Select which content to include in your quiz</Text>

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

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.beginButton, (selectedCount === 0 || isStarting) ? styles.beginButtonDisabled : null]}
            onPress={() => void handleBeginQuiz()}
            disabled={selectedCount === 0 || isStarting}
          >
            {isStarting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.beginButtonText}>
                {selectedCount === 0
                  ? 'Select at least one item'
                  : `Begin Quiz · ${totalQuestions} question${totalQuestions !== 1 ? 's' : ''}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
