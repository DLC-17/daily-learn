import { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import api from '../../services/api';
import { useColors } from '../../hooks/useColors';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { spacing, fontSizes, borderRadius } from '../../constants/theme';
import type { ColorPalette } from '../../constants/theme';

interface Topic {
  id: string;
  name: string;
}

interface Flashcard {
  id: string;
  term: string;
  definition: string;
  content_title: string;
}

const fetchTopics = async (): Promise<Topic[]> => {
  const { data } = await api.get<{ data: Topic[] }>('/topics');
  return data.data;
};

const fetchFlashcards = async (topicId: string | null): Promise<Flashcard[]> => {
  const params = topicId ? `?topic_id=${topicId}` : '';
  const { data } = await api.get<{ data: Flashcard[] }>(`/flashcards${params}`);
  return data.data;
};

const createStyles = (c: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, padding: spacing.md },
    heading: { fontSize: fontSizes.xxl, fontWeight: 'bold', color: c.text, marginBottom: spacing.md },
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
    deckArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: {
      width: '90%',
      minHeight: 220,
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    cardSideLabel: {
      fontSize: fontSizes.xs,
      fontWeight: '700',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.md,
    },
    cardTerm: {
      fontSize: fontSizes.xl,
      fontWeight: 'bold',
      color: c.text,
      textAlign: 'center',
      lineHeight: 30,
    },
    cardDefinition: {
      fontSize: fontSizes.md,
      color: c.text,
      textAlign: 'center',
      lineHeight: 24,
    },
    cardSource: {
      fontSize: fontSizes.xs,
      color: c.textSecondary,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    tapHint: {
      fontSize: fontSizes.xs,
      color: c.textSecondary,
      marginTop: spacing.lg,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
      marginTop: spacing.lg,
    },
    navButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navButtonDisabled: { opacity: 0.3 },
    navButtonText: { fontSize: fontSizes.lg, color: c.text },
    counter: { fontSize: fontSizes.sm, color: c.textSecondary, minWidth: 50, textAlign: 'center' },
    generateButton: {
      backgroundColor: c.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
    },
    generateButtonText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
    regenerateRow: { alignItems: 'center', marginTop: spacing.md },
    regenerateText: { fontSize: fontSizes.sm, color: c.primary, fontWeight: '500' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
    emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600', color: c.text, textAlign: 'center' },
    emptySubtext: { fontSize: fontSizes.sm, color: c.textSecondary, textAlign: 'center', marginBottom: spacing.md },
    loader: { marginTop: spacing.xl },
  });

export default function CardsScreen() {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const scaleAnimRef = useRef(new Animated.Value(1));
  const scaleAnim = scaleAnimRef.current;
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const { data: topics } = useQuery({ queryKey: ['topics'], queryFn: fetchTopics });

  const {
    data: flashcards,
    isLoading: cardsLoading,
  } = useQuery({
    queryKey: ['flashcards', selectedTopicId],
    queryFn: () => fetchFlashcards(selectedTopicId),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body = selectedTopicId ? { topic_id: selectedTopicId } : {};
      const { data } = await api.post<{ data: { flashcardsGenerated: number } }>(
        '/flashcards/generate',
        body,
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flashcards', selectedTopicId] });
      setCardIndex(0);
      setIsFlipped(false);
    },
    onError: (err) => {
      const msg = isAxiosError(err)
        ? (err.response?.data as { error?: { message?: string } })?.error?.message ?? 'Generation failed'
        : 'Generation failed';
      console.error('Flashcard generation error:', msg);
    },
  });

  const cards = flashcards ?? [];
  const currentCard = cards[cardIndex];
  const topicItems = [{ id: null as string | null, name: 'All' }, ...(topics ?? [])];

  const animateFlip = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(callback);
  };

  const handleFlip = () => {
    animateFlip(() => setIsFlipped((v) => !v));
  };

  const goNext = () => {
    if (cardIndex >= cards.length - 1) return;
    animateFlip(() => {
      setIsFlipped(false);
      setCardIndex((i) => i + 1);
    });
  };

  const goPrev = () => {
    if (cardIndex <= 0) return;
    animateFlip(() => {
      setIsFlipped(false);
      setCardIndex((i) => i - 1);
    });
  };

  const handleTopicSelect = (id: string | null) => {
    setSelectedTopicId(id);
    setCardIndex(0);
    setIsFlipped(false);
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={styles.heading}>Flashcards</Text>

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
                  onPress={() => handleTopicSelect(item.id)}
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

        {cardsLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : cards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No flashcards yet</Text>
            <Text style={styles.emptySubtext}>
              {selectedTopicId
                ? 'Generate flashcards for this topic from your uploaded material.'
                : 'Select a topic or generate flashcards from all your content.'}
            </Text>
            <TouchableOpacity
              style={[styles.generateButton, generateMutation.isPending ? { opacity: 0.6 } : null]}
              onPress={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.generateButtonText}>Generate Flashcards</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.deckArea}>
              <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%', alignItems: 'center' }}>
                <TouchableOpacity
                  style={styles.card}
                  onPress={handleFlip}
                  activeOpacity={0.9}
                >
                  <Text style={styles.cardSideLabel}>{isFlipped ? 'Definition' : 'Term'}</Text>
                  {isFlipped ? (
                    <>
                      <Text style={styles.cardDefinition}>{currentCard?.definition}</Text>
                      {currentCard?.content_title && (
                        <Text style={styles.cardSource}>{currentCard.content_title}</Text>
                      )}
                    </>
                  ) : (
                    <Text style={styles.cardTerm}>{currentCard?.term}</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.tapHint}>Tap card to {isFlipped ? 'see term' : 'reveal definition'}</Text>
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity
                style={[styles.navButton, cardIndex === 0 ? styles.navButtonDisabled : null]}
                onPress={goPrev}
                disabled={cardIndex === 0}
              >
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.counter}>{cardIndex + 1} / {cards.length}</Text>
              <TouchableOpacity
                style={[styles.navButton, cardIndex === cards.length - 1 ? styles.navButtonDisabled : null]}
                onPress={goNext}
                disabled={cardIndex === cards.length - 1}
              >
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.regenerateRow}>
              <TouchableOpacity
                onPress={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={styles.regenerateText}>Regenerate</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </ScreenWrapper>
  );
}
