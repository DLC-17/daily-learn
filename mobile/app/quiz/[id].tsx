import { useState } from 'react';
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
import { colors, spacing, fontSizes, borderRadius } from '../../constants/theme';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
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

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);

  const { data: question, isLoading, isError } = useQuery({
    queryKey: ['question', id],
    queryFn: () => fetchQuestion(id),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: submitSession,
    onSuccess: (data) => setResult(data),
  });

  const handleSubmit = () => {
    if (selectedIndex === null || !question) return;
    mutation.mutate({ question_id: question.id, answer_index: selectedIndex });
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !question) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load question.</Text>
        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
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
        <View style={[styles.resultBanner, result.correct ? styles.resultCorrect : styles.resultWrong]}>
          <Text style={styles.resultTitle}>{result.correct ? '✓ Correct!' : '✗ Incorrect'}</Text>
          <Text style={styles.explanation}>{result.explanation}</Text>
        </View>
      ) : null}

      {!result ? (
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
      ) : (
        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: colors.background, padding: spacing.lg },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  questionText: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 28,
    marginBottom: spacing.xl,
  },
  optionList: { gap: spacing.sm, marginBottom: spacing.xl },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  optionSelected: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  optionCorrect: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: colors.success,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  optionWrong: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  optionLabel: { fontSize: fontSizes.md, fontWeight: '700', color: colors.primary, width: 20, marginTop: 1 },
  optionText: { flex: 1, fontSize: fontSizes.md, color: colors.text, lineHeight: 22 },
  optionTextSelected: { flex: 1, fontSize: fontSizes.md, color: colors.primary, fontWeight: '500', lineHeight: 22 },
  optionTextResult: { flex: 1, fontSize: fontSizes.md, color: colors.text, fontWeight: '500', lineHeight: 22 },
  resultBanner: { borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg },
  resultCorrect: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: colors.success },
  resultWrong: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: colors.error },
  resultTitle: { fontSize: fontSizes.md, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  explanation: { fontSize: fontSizes.sm, color: colors.text, lineHeight: 20 },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
  doneButton: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  doneButtonText: { color: colors.text, fontSize: fontSizes.md, fontWeight: '600' },
  errorText: { fontSize: fontSizes.md, color: colors.textSecondary, marginBottom: spacing.lg },
});
