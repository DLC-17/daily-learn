import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import api from '../../services/api';
import { useColors } from '../../hooks/useColors';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { spacing, fontSizes, borderRadius } from '../../constants/theme';
import type { ColorPalette } from '../../constants/theme';

interface Flashcard {
  id: string;
  term: string;
  definition: string;
  content_title: string;
}

const fetchFlashcards = async (): Promise<Flashcard[]> => {
  const { data } = await api.get<{ data: Flashcard[] }>('/flashcards');
  return data.data;
};

const createStyles = (c: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, padding: spacing.md },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    heading: { fontSize: fontSizes.xxl, fontWeight: 'bold', color: c.text },
    editButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    editButtonText: { fontSize: fontSizes.sm, color: c.textSecondary, fontWeight: '500' },
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
    regenerateRow: { alignItems: 'center', marginTop: spacing.md },
    regenerateText: { fontSize: fontSizes.sm, color: c.primary, fontWeight: '500' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600', color: c.text, textAlign: 'center' },
    emptySubtext: { fontSize: fontSizes.sm, color: c.textSecondary, textAlign: 'center', marginBottom: spacing.md },
    generateButton: {
      backgroundColor: c.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
    },
    generateButtonText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
    loader: { marginTop: spacing.xl },
  });

export default function CardsScreen() {
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: flashcards, isLoading } = useQuery({
    queryKey: ['flashcards'],
    queryFn: fetchFlashcards,
  });

  const cards = flashcards ?? [];
  const currentCard = cards[cardIndex];

  const animateFlip = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(callback);
  };

  const handleFlip = () => animateFlip(() => setIsFlipped((v) => !v));

  const goNext = () => {
    if (cardIndex >= cards.length - 1) return;
    animateFlip(() => { setIsFlipped(false); setCardIndex((i) => i + 1); });
  };

  const goPrev = () => {
    if (cardIndex <= 0) return;
    animateFlip(() => { setIsFlipped(false); setCardIndex((i) => i - 1); });
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Flashcards</Text>
          {cards.length > 0 && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/cards/config')}
            >
              <Text style={styles.editButtonText}>Choose Material</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : cards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No flashcards yet</Text>
            <Text style={styles.emptySubtext}>
              Choose which uploaded content to turn into flashcards.
            </Text>
            <TouchableOpacity
              style={styles.generateButton}
              onPress={() => router.push('/cards/config')}
            >
              <Text style={styles.generateButtonText}>Choose Material</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.deckArea}>
              <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%', alignItems: 'center' }}>
                <TouchableOpacity style={styles.card} onPress={handleFlip} activeOpacity={0.9}>
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
              <TouchableOpacity onPress={() => router.push('/cards/config')}>
                <Text style={styles.regenerateText}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </ScreenWrapper>
  );
}
