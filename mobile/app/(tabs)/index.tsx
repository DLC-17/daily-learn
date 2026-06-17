import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { colors, spacing, fontSizes, borderRadius } from '../../constants/theme';

interface UserProfile {
  streak_count: number;
  last_active: string | null;
}

interface QuizSession {
  id: string;
  is_correct: boolean;
  shown_at: string;
}

const fetchProfile = async (): Promise<UserProfile> => {
  const { data } = await api.get<{ data: UserProfile }>('/user/profile');
  return data.data;
};

const fetchSessions = async (): Promise<QuizSession[]> => {
  const { data } = await api.get<{ data: QuizSession[] }>('/quiz/sessions?limit=100');
  return data.data;
};

const todayStr = () => new Date().toISOString().split('T')[0]!;

export default function HomeScreen() {
  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useQuery({ queryKey: ['profile'], queryFn: fetchProfile });

  const {
    data: sessions,
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useQuery({ queryKey: ['sessions-home'], queryFn: fetchSessions });

  const isLoading = profileLoading || sessionsLoading;
  const onRefresh = () => { void refetchProfile(); void refetchSessions(); };

  const today = todayStr();
  const todaySessions = (sessions ?? []).filter((s) => s.shown_at.startsWith(today));
  const todayCorrect = todaySessions.filter((s) => s.is_correct).length;
  const totalSessions = sessions?.length ?? 0;
  const totalCorrect = (sessions ?? []).filter((s) => s.is_correct).length;
  const accuracy = totalSessions > 0 ? Math.round((totalCorrect / totalSessions) * 100) : 0;

  const dailyGoal = 3;
  const progress = Math.min(todaySessions.length, dailyGoal);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <Text style={styles.heading}>Daily Learn</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <View style={styles.streakCard}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <View>
              <Text style={styles.streakCount}>{profile?.streak_count ?? 0}</Text>
              <Text style={styles.streakLabel}>day streak</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Progress</Text>
            <View style={styles.progressRow}>
              {Array.from({ length: dailyGoal }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.progressDot, i < progress ? styles.progressDotFilled : null]}
                />
              ))}
              <Text style={styles.progressLabel}>{progress}/{dailyGoal} questions</Text>
            </View>
            {progress === 0 && (
              <Text style={styles.hint}>
                You'll receive 3 quiz notifications today. Tap one to get started!
              </Text>
            )}
            {progress > 0 && progress < dailyGoal && (
              <Text style={styles.hint}>
                Keep going — {dailyGoal - progress} more to complete today.
              </Text>
            )}
            {progress >= dailyGoal && (
              <Text style={[styles.hint, styles.hintSuccess]}>
                All done for today. Great work!
              </Text>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalSessions}</Text>
              <Text style={styles.statLabel}>Answered</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{accuracy}%</Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{todaySessions.length > 0 ? todayCorrect : '—'}</Text>
              <Text style={styles.statLabel}>Today Correct</Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: {
    fontSize: fontSizes.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  loader: { marginTop: spacing.xl },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  streakEmoji: { fontSize: 40 },
  streakCount: { fontSize: 36, fontWeight: 'bold', color: colors.text },
  streakLabel: { fontSize: fontSizes.sm, color: colors.textSecondary },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
    borderWidth: 2,
    borderColor: colors.border,
  },
  progressDotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  progressLabel: { fontSize: fontSizes.sm, color: colors.textSecondary, marginLeft: spacing.xs },
  hint: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  hintSuccess: { color: colors.success, fontWeight: '500' },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: fontSizes.xl, fontWeight: 'bold', color: colors.text },
  statLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
});
