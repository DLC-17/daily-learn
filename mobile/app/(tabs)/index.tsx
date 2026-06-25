import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
  useColorScheme,
} from 'react-native';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import api from '../../services/api';
import { useColors } from '../../hooks/useColors';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { spacing, fontSizes, borderRadius } from '../../constants/theme';
import type { ColorPalette } from '../../constants/theme';

type DayCell = { date: string; count: number };

const CAL_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAL_WEEKS = 26;

function buildCalendar(sessions: { shown_at: string }[]): DayCell[][] {
  const countByDate: Record<string, number> = {};
  for (const s of sessions) {
    const d = s.shown_at.split('T')[0]!;
    countByDate[d] = (countByDate[d] ?? 0) + 1;
  }
  const today = new Date();
  const days: DayCell[] = [];
  for (let i = CAL_WEEKS * 7 - 1; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - i);
    const str = dt.toISOString().split('T')[0]!;
    days.push({ date: str, count: countByDate[str] ?? 0 });
  }
  const weeks: DayCell[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function calColor(count: number, isDark: boolean): string {
  if (isDark) {
    if (count === 0) return '#202A3A';
    if (count <= 2) return '#0A2040';
    if (count <= 5) return '#103878';
    if (count <= 9) return '#2057B8';
    return '#4F8EF7';
  }
  if (count === 0) return '#E4EBF8';
  if (count <= 2) return '#BFD0EE';
  if (count <= 5) return '#80A8E0';
  if (count <= 9) return '#4F8EF7';
  return '#2563EB';
}

interface UserProfile {
  streak_count: number;
  last_active: string | null;
}

interface QuizSession {
  id: string;
  is_correct: boolean;
  shown_at: string;
}

interface Topic {
  id: string;
  name: string;
}

interface Question {
  id: string;
}

const fetchProfile = async (): Promise<UserProfile> => {
  const { data } = await api.get<{ data: UserProfile }>('/user/profile');
  return data.data;
};

const fetchSessions = async (): Promise<QuizSession[]> => {
  const { data } = await api.get<{ data: QuizSession[] }>('/quiz/sessions?limit=500');
  return data.data;
};

const fetchTopics = async (): Promise<Topic[]> => {
  const { data } = await api.get<{ data: Topic[] }>('/topics');
  return data.data;
};

const fetchNextQuestion = async (topicId: string | null): Promise<Question | null> => {
  const params = topicId ? `?topic_id=${topicId}` : '';
  const { data } = await api.get<{ data: Question[] }>(`/questions${params}`);
  return data.data[0] ?? null;
};

const todayStr = () => new Date().toISOString().split('T')[0]!;

const createStyles = (c: ColorPalette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { padding: spacing.lg, paddingBottom: spacing.xxl },
    heading: { fontSize: fontSizes.xxl, fontWeight: 'bold', color: c.text, marginBottom: spacing.lg },
    loader: { marginTop: spacing.xl },
    streakCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    streakEmoji: { fontSize: 40 },
    streakCount: { fontSize: 36, fontWeight: 'bold', color: c.text },
    streakLabel: { fontSize: fontSizes.sm, color: c.textSecondary },
    topicRow: { paddingBottom: spacing.md, gap: spacing.sm },
    topicChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: borderRadius.full,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      maxWidth: 160,
    },
    topicChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    topicChipText: { fontSize: fontSizes.sm, color: c.textSecondary, fontWeight: '500' },
    topicChipTextActive: { color: '#fff' },
    quizButton: {
      backgroundColor: c.primary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    quizButtonDisabled: { opacity: 0.4 },
    quizButtonText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
    section: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    sectionTitle: { fontSize: fontSizes.md, fontWeight: '600', color: c.text, marginBottom: spacing.sm },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    progressDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.border,
      borderWidth: 2,
      borderColor: c.border,
    },
    progressDotFilled: { backgroundColor: c.primary, borderColor: c.primary },
    progressLabel: { fontSize: fontSizes.sm, color: c.textSecondary, marginLeft: spacing.xs },
    hint: { fontSize: fontSizes.sm, color: c.textSecondary, lineHeight: 20 },
    hintSuccess: { color: c.success, fontWeight: '500' },
    statsRow: { flexDirection: 'row', gap: spacing.sm },
    statCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      alignItems: 'center',
    },
    statValue: { fontSize: fontSizes.xl, fontWeight: 'bold', color: c.text },
    statLabel: { fontSize: fontSizes.xs, color: c.textSecondary, marginTop: 2 },
    calSection: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    calMonthRow: { flexDirection: 'row' as const, gap: 2, marginBottom: 5, height: 14 },
    calGrid: { flexDirection: 'row' as const, gap: 2 },
    calWeek: { flexDirection: 'column' as const, gap: 2 },
    calCell: { width: 10, height: 10, borderRadius: 2 },
    calMonthLabel: {
      fontSize: 9,
      color: c.textSecondary,
      position: 'absolute' as const,
      top: 0,
      left: 0,
      lineHeight: 12,
    },
  });

export default function HomeScreen() {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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

  const { data: topics } = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
  });

  const { data: nextQuestion } = useQuery({
    queryKey: ['next-question', selectedTopicId],
    queryFn: () => fetchNextQuestion(selectedTopicId),
  });

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

  const calWeeks = useMemo(() => buildCalendar(sessions ?? []), [sessions]);
  const topicItems = [{ id: null as string | null, name: 'All' }, ...(topics ?? [])];

  const startQuiz = () => {
    if (!nextQuestion) return;
    const param = selectedTopicId ? `?topicId=${selectedTopicId}` : '';
    router.push(`/quiz/${nextQuestion.id}${param}`);
  };

  return (
    <ScreenWrapper>
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

            {topicItems.length > 1 && (
              <FlatList
                data={topicItems}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id ?? 'all'}
                contentContainerStyle={styles.topicRow}
                renderItem={({ item }) => {
                  const active = selectedTopicId === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.topicChip, active ? styles.topicChipActive : null]}
                      onPress={() => setSelectedTopicId(item.id)}
                    >
                      <Text
                        style={[styles.topicChipText, active ? styles.topicChipTextActive : null]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <TouchableOpacity
              style={[styles.quizButton, !nextQuestion ? styles.quizButtonDisabled : null]}
              onPress={startQuiz}
              disabled={!nextQuestion}
            >
              <Text style={styles.quizButtonText}>
                {nextQuestion ? 'Start Quiz' : 'No questions yet — upload some content first'}
              </Text>
            </TouchableOpacity>

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
                <Text style={styles.hint}>Tap Start Quiz or a notification to begin.</Text>
              )}
              {progress > 0 && progress < dailyGoal && (
                <Text style={styles.hint}>Keep going — {dailyGoal - progress} more to complete today.</Text>
              )}
              {progress >= dailyGoal && (
                <Text style={[styles.hint, styles.hintSuccess]}>All done for today. Great work!</Text>
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
                <Text style={styles.statValue}>{todayCorrect}</Text>
                <Text style={styles.statLabel}>Today Correct</Text>
              </View>
            </View>

            {/* Activity Calendar */}
            <View style={styles.calSection}>
              <Text style={[styles.sectionTitle, { marginBottom: spacing.xs }]}>Activity</Text>
              {/* Month labels */}
              <View style={styles.calMonthRow}>
                {calWeeks.map((week, wi) => {
                  const cur = week[0]?.date.slice(5, 7) ?? '01';
                  const prev = calWeeks[wi - 1]?.[0]?.date.slice(5, 7);
                  const isNew = wi === 0 || cur !== prev;
                  return (
                    <View key={wi} style={{ width: 10 }}>
                      {isNew && (
                        <Text style={styles.calMonthLabel}>
                          {CAL_MONTHS[parseInt(cur) - 1]}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
              {/* Grid */}
              <View style={styles.calGrid}>
                {calWeeks.map((week, wi) => (
                  <View key={wi} style={styles.calWeek}>
                    {week.map((day) => (
                      <View
                        key={day.date}
                        style={[styles.calCell, { backgroundColor: calColor(day.count, isDark) }]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
