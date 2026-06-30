import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../services/api';
import { useColors } from '../../hooks/useColors';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { spacing, fontSizes, borderRadius } from '../../constants/theme';
import type { ColorPalette } from '../../constants/theme';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  source_text: string | null;
}

interface SessionResult {
  correct: boolean;
  explanation: string;
}

const fetchQuestion = async (id: string): Promise<Question> => {
  const { data } = await api.get<{ data: Question }>(`/questions/${id}`);
  return data.data;
};

const submitSession = async (payload: {
  question_id: string;
  answer_index: number;
}): Promise<SessionResult> => {
  const { data } = await api.post<{ data: SessionResult }>('/quiz/session', payload);
  return data.data;
};

const createStyles = (c: ColorPalette) =>
  StyleSheet.create({
    container: { flexGrow: 1, padding: spacing.lg },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    questionText: {
      fontSize: fontSizes.lg,
      fontWeight: '600',
      color: c.text,
      lineHeight: 28,
      marginBottom: spacing.xl,
    },
    optionList: { gap: spacing.sm, marginBottom: spacing.xl },
    option: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    optionSelected: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.primary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    optionCorrect: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: c.surfaceSuccess,
      borderWidth: 1.5,
      borderColor: c.success,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    optionWrong: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: c.surfaceError,
      borderWidth: 1.5,
      borderColor: c.error,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    optionLabel: { fontSize: fontSizes.md, fontWeight: '700', color: c.primary, width: 20, marginTop: 1 },
    optionText: { flex: 1, fontSize: fontSizes.md, color: c.text, lineHeight: 22 },
    optionTextSelected: { flex: 1, fontSize: fontSizes.md, color: c.primary, fontWeight: '500', lineHeight: 22 },
    optionTextResult: { flex: 1, fontSize: fontSizes.md, color: c.text, fontWeight: '500', lineHeight: 22 },
    resultBanner: { borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
    resultCorrect: { backgroundColor: c.surfaceSuccess, borderWidth: 1, borderColor: c.success },
    resultWrong: { backgroundColor: c.surfaceError, borderWidth: 1, borderColor: c.error },
    resultTitle: { fontSize: fontSizes.md, fontWeight: '700', color: c.text, marginBottom: spacing.xs },
    explanation: { fontSize: fontSizes.sm, color: c.text, lineHeight: 20 },
    sourceCard: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    sourceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    sourceHeaderLabel: { fontSize: fontSizes.xs, fontWeight: '700', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
    sourceToggle: { fontSize: fontSizes.xs, color: c.primary, fontWeight: '600' },
    sourceText: {
      fontSize: fontSizes.sm,
      color: c.text,
      lineHeight: 20,
      padding: spacing.md,
    },
    submitButton: {
      backgroundColor: c.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    submitDisabled: { opacity: 0.4 },
    submitText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
    actionRow: { gap: spacing.sm },
    actionButton: { paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
    nextButton: { backgroundColor: c.primary },
    nextButtonText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
    doneButton: { backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border },
    doneButtonSecondary: { backgroundColor: 'transparent', borderColor: 'transparent' },
    doneButtonText: { color: c.text, fontSize: fontSizes.md, fontWeight: '600' },
    doneButtonTextSecondary: { color: c.textSecondary },
    errorText: { fontSize: fontSizes.md, color: c.textSecondary, marginBottom: spacing.lg },
  });

export default function QuizScreen() {
  const { id, topicId, contentId, contentIds } = useLocalSearchParams<{ id: string; topicId?: string; contentId?: string; contentIds?: string }>();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: question, isLoading, isError } = useQuery({
    queryKey: ['question', id],
    queryFn: () => fetchQuestion(id),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: submitSession,
    onSuccess: async (data) => {
      setResult(data);
      setSourceExpanded(false);
      try {
        const params = new URLSearchParams({ exclude: id });
        if (contentIds) params.set('content_ids', contentIds);
        else if (topicId) params.set('topic_id', topicId);
        else if (contentId) params.set('content_id', contentId);
        const { data: qData } = await api.get<{ data: { id: string }[] }>(`/questions?${params}`);
        setNextId(qData.data[0]?.id ?? null);
      } catch {
        setNextId(null);
      }
    },
  });

  const handleSubmit = () => {
    if (selectedIndex === null || !question) return;
    mutation.mutate({ question_id: question.id, answer_index: selectedIndex });
  };

  const handleNext = () => {
    if (!nextId) return;
    setSelectedIndex(null);
    setResult(null);
    setNextId(null);
    setSourceExpanded(false);
    const params: Record<string, string> = { id: nextId };
    if (contentIds) params['contentIds'] = contentIds;
    else if (topicId) params['topicId'] = topicId;
    else if (contentId) params['contentId'] = contentId;
    router.replace({ pathname: '/quiz/[id]', params });
  };

  const getOptionStyle = (index: number) => {
    if (!result) return selectedIndex === index ? styles.optionSelected : styles.option;
    if (index === question?.correct_index) return styles.optionCorrect;
    if (index === selectedIndex && !result.correct) return styles.optionWrong;
    return styles.option;
  };

  const getOptionTextStyle = (index: number) => {
    if (!result) return selectedIndex === index ? styles.optionTextSelected : styles.optionText;
    if (index === question?.correct_index || (index === selectedIndex && !result.correct))
      return styles.optionTextResult;
    return styles.optionText;
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

  if (isError || !question) {
    return (
      <ScreenWrapper applyTopInset={false}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Could not load question.</Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper applyTopInset={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.questionText}>{question.question_text}</Text>

        <View style={styles.optionList}>
          {question.options.map((opt, index) => (
            <TouchableOpacity
              key={index}
              style={getOptionStyle(index)}
              onPress={() => { if (!result) setSelectedIndex(index); }}
              disabled={!!result}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedIndex === index }}
            >
              <Text style={styles.optionLabel}>{String.fromCharCode(65 + index)}.</Text>
              <Text style={getOptionTextStyle(index)}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {result ? (
          <>
            <View style={[styles.resultBanner, result.correct ? styles.resultCorrect : styles.resultWrong]}>
              <Text style={styles.resultTitle}>{result.correct ? '✓ Correct!' : '✗ Incorrect'}</Text>
              <Text style={styles.explanation}>{result.explanation}</Text>
            </View>

            {question.source_text ? (
              <View style={styles.sourceCard}>
                <TouchableOpacity
                  style={styles.sourceHeader}
                  onPress={() => setSourceExpanded((v) => !v)}
                >
                  <Text style={styles.sourceHeaderLabel}>Source</Text>
                  <Text style={styles.sourceToggle}>{sourceExpanded ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
                {sourceExpanded && (
                  <Text style={styles.sourceText}>{question.source_text}</Text>
                )}
              </View>
            ) : null}

            <View style={styles.actionRow}>
              {nextId ? (
                <TouchableOpacity style={[styles.actionButton, styles.nextButton]} onPress={handleNext}>
                  <Text style={styles.nextButtonText}>Next Question</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.actionButton, styles.doneButton, nextId ? styles.doneButtonSecondary : null]}
                onPress={() => router.back()}
              >
                <Text style={[styles.doneButtonText, nextId ? styles.doneButtonTextSecondary : null]}>Done</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, selectedIndex === null || mutation.isPending ? styles.submitDisabled : null]}
            onPress={handleSubmit}
            disabled={selectedIndex === null || mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Submit Answer</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
