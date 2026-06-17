import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { colors, spacing, fontSizes, borderRadius } from '../../constants/theme';

interface Session {
  id: string;
  question_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  answer_index: number;
  is_correct: boolean;
  shown_at: string;
}

const fetchSessions = async (): Promise<Session[]> => {
  const { data } = await api.get<{ data: Session[] }>('/quiz/sessions?limit=50');
  return data.data;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function HistoryScreen() {
  const { data: sessions, isLoading, refetch } = useQuery({
    queryKey: ['sessions-history'],
    queryFn: fetchSessions,
  });

  const total = sessions?.length ?? 0;
  const correct = (sessions ?? []).filter((s) => s.is_correct).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
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
          data={sessions ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => void refetch()}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.badge, item.is_correct ? styles.badgeCorrect : styles.badgeWrong]}>
                <Text style={styles.badgeText}>{item.is_correct ? '✓' : '✗'}</Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.questionText} numberOfLines={2}>{item.question_text}</Text>
                <Text style={styles.meta}>{formatDate(item.shown_at)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No quiz sessions yet.</Text>
              <Text style={styles.emptySubtext}>
                Answer questions from your push notifications to see history here.
              </Text>
            </View>
          }
          contentContainerStyle={total === 0 ? styles.emptyContainer : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  heading: {
    fontSize: fontSizes.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: fontSizes.xl, fontWeight: 'bold', color: colors.text },
  summaryLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
  divider: { width: 1, height: 40, backgroundColor: colors.border },
  loader: { marginTop: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  badgeCorrect: { backgroundColor: '#DCFCE7' },
  badgeWrong: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: fontSizes.sm, fontWeight: '700' },
  rowContent: { flex: 1 },
  questionText: { fontSize: fontSizes.sm, color: colors.text, lineHeight: 20, marginBottom: 4 },
  meta: { fontSize: fontSizes.xs, color: colors.textSecondary },
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyText: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
