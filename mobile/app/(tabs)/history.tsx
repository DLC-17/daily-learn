import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { useColors } from '../../hooks/useColors';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { spacing, fontSizes, borderRadius } from '../../constants/theme';
import type { ColorPalette } from '../../constants/theme';

interface Session {
  id: string;
  question_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  answer_index: number;
  is_correct: boolean;
  shown_at: string;
  content_id: string;
  content_title: string;
}

interface ContentGroup {
  contentId: string;
  contentTitle: string;
  sessions: Session[];
  correct: number;
}

const fetchSessions = async (): Promise<Session[]> => {
  const { data } = await api.get<{ data: Session[] }>('/quiz/sessions?limit=500');
  return data.data;
};

const groupByContent = (sessions: Session[]): ContentGroup[] => {
  const map = new Map<string, ContentGroup>();
  for (const s of sessions) {
    const existing = map.get(s.content_id);
    if (existing) {
      existing.sessions.push(s);
      if (s.is_correct) existing.correct++;
    } else {
      map.set(s.content_id, {
        contentId: s.content_id,
        contentTitle: s.content_title,
        sessions: [s],
        correct: s.is_correct ? 1 : 0,
      });
    }
  }
  return Array.from(map.values());
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const createStyles = (c: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, padding: spacing.md },
    heading: { fontSize: fontSizes.xxl, fontWeight: 'bold', color: c.text, marginBottom: spacing.md },
    summaryRow: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      alignItems: 'center',
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryValue: { fontSize: fontSizes.xl, fontWeight: 'bold', color: c.text },
    summaryLabel: { fontSize: fontSizes.xs, color: c.textSecondary, marginTop: 2 },
    divider: { width: 1, height: 40, backgroundColor: c.border },
    loader: { marginTop: spacing.xl },
    listContent: { paddingBottom: spacing.xl },
    groupCard: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    groupHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
    groupInfo: { flex: 1 },
    groupTitle: { fontSize: fontSizes.md, fontWeight: '600', color: c.text },
    groupMeta: { fontSize: fontSizes.xs, color: c.textSecondary, marginTop: 2 },
    chevron: { fontSize: fontSizes.xs, color: c.textSecondary, marginLeft: spacing.sm },
    sessionList: { borderTopWidth: 1, borderTopColor: c.border },
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: spacing.md,
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    badge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 1,
    },
    badgeCorrect: { backgroundColor: '#DCFCE7' },
    badgeWrong: { backgroundColor: '#FEE2E2' },
    badgeText: { fontSize: fontSizes.sm, fontWeight: '700' },
    sessionContent: { flex: 1 },
    questionText: { fontSize: fontSizes.sm, color: c.text, lineHeight: 20, marginBottom: 4 },
    answerHint: { fontSize: fontSizes.xs, color: c.error, lineHeight: 18, marginBottom: 4 },
    meta: { fontSize: fontSizes.xs, color: c.textSecondary },
    empty: { alignItems: 'center', paddingHorizontal: spacing.xl },
    emptyContainer: { flex: 1, justifyContent: 'center' },
    emptyText: { fontSize: fontSizes.lg, fontWeight: '600', color: c.text, marginBottom: spacing.sm, textAlign: 'center' },
    emptySubtext: { fontSize: fontSizes.sm, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },
  });

export default function HistoryScreen() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: sessions, isLoading, refetch } = useQuery({
    queryKey: ['sessions-history'],
    queryFn: fetchSessions,
  });

  const groups = groupByContent(sessions ?? []);
  const total = sessions?.length ?? 0;
  const correct = (sessions ?? []).filter((s) => s.is_correct).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const toggleExpand = (contentId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) next.delete(contentId);
      else next.add(contentId);
      return next;
    });
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={styles.heading}>History</Text>

        {total > 0 && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{total}</Text>
              <Text style={styles.summaryLabel}>Answered</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{accuracy}%</Text>
              <Text style={styles.summaryLabel}>Correct</Text>
            </View>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(item) => item.contentId}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} tintColor={colors.primary} />
            }
            renderItem={({ item: group }) => {
              const isOpen = expanded.has(group.contentId);
              const pct = Math.round((group.correct / group.sessions.length) * 100);
              return (
                <View style={styles.groupCard}>
                  <TouchableOpacity style={styles.groupHeader} onPress={() => toggleExpand(group.contentId)}>
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupTitle} numberOfLines={1}>{group.contentTitle}</Text>
                      <Text style={styles.groupMeta}>
                        {group.correct}/{group.sessions.length} correct · {pct}%
                      </Text>
                    </View>
                    <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.sessionList}>
                      {group.sessions.map((s) => (
                        <View key={s.id} style={styles.sessionRow}>
                          <View style={[styles.badge, s.is_correct ? styles.badgeCorrect : styles.badgeWrong]}>
                            <Text style={styles.badgeText}>{s.is_correct ? '✓' : '✗'}</Text>
                          </View>
                          <View style={styles.sessionContent}>
                            <Text style={styles.questionText} numberOfLines={3}>{s.question_text}</Text>
                            {!s.is_correct && (
                              <Text style={styles.answerHint}>
                                Your answer: {s.options[s.answer_index] ?? '—'}{'\n'}
                                Correct: {s.options[s.correct_index] ?? '—'}
                              </Text>
                            )}
                            <Text style={styles.meta}>{formatDate(s.shown_at)}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No quiz sessions yet.</Text>
                <Text style={styles.emptySubtext}>Answer questions to see your history here.</Text>
              </View>
            }
            contentContainerStyle={groups.length === 0 ? styles.emptyContainer : styles.listContent}
          />
        )}
      </View>
    </ScreenWrapper>
  );
}
