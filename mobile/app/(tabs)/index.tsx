import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import api from '../../services/api';
import { useColors } from '../../hooks/useColors';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { spacing, fontSizes, borderRadius } from '../../constants/theme';
import type { ColorPalette } from '../../constants/theme';

interface UserProfile {
  streak_count: number;
  last_active: string | null;
}

interface QuizSession {
  id: string;
  is_correct: boolean;
  shown_at: string;
}

interface ContentItem {
  id: string;
  title: string;
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

const fetchContent = async (): Promise<ContentItem[]> => {
  const { data } = await api.get<{ data: ContentItem[] }>('/content');
  return data.data;
};

const fetchNextQuestion = async (contentId: string | null): Promise<Question | null> => {
  const params = contentId ? `?content_id=${contentId}` : '';
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
  });

export default function HomeScreen() {
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  const { data: contentList } = useQuery({
    queryKey: ['content'],
    queryFn: fetchContent,
  });

  const { data: nextQuestion } = useQuery({
    queryKey: ['next-question', selectedContentId],
    queryFn: () => fetchNextQuestion(selectedContentId),
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

  const topics = [{ id: null, title: 'All' }, ...(contentList ?? [])];

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

            {topics.length > 1 && (
              <FlatList
                data={topics}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id ?? 'all'}
                contentContainerStyle={styles.topicRow}
                renderItem={({ item }) => {
                  const active = selectedContentId === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.topicChip, active ? styles.topicChipActive : null]}
                      onPress={() => setSelectedContentId(item.id)}
                    >
                      <Text
                        style={[styles.topicChipText, active ? styles.topicChipTextActive : null]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <TouchableOpacity
              style={[styles.quizButton, !nextQuestion ? styles.quizButtonDisabled : null]}
              onPress={() =>
                nextQuestion &&
                router.push(
                  `/quiz/${nextQuestion.id}${selectedContentId ? `?contentId=${selectedContentId}` : ''}`,
                )
              }
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
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
