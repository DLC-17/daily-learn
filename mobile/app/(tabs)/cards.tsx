import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { useColors } from '../../hooks/useColors';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { spacing, fontSizes, borderRadius } from '../../constants/theme';
import type { ColorPalette } from '../../constants/theme';
import * as db from '../../services/db';
import * as syncService from '../../services/sync';
import { applyReview } from '../../services/sm2';
import type { LocalCard } from '../../services/db';
import type { Quality } from '../../services/sm2';

type Phase = 'loading' | 'syncing' | 'reviewing' | 'empty' | 'done';

const SWIPE_THRESHOLD = 100;

const createStyles = (c: ColorPalette) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    title: { fontSize: fontSizes.xxl, fontWeight: 'bold', color: c.text },
    headerRight: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    syncBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: borderRadius.full,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    syncBadgeText: { fontSize: fontSizes.xs, color: c.textSecondary },
    editButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    editButtonText: { fontSize: fontSizes.sm, color: c.textSecondary, fontWeight: '500' },
    progressBar: {
      height: 4,
      backgroundColor: c.border,
      marginHorizontal: spacing.lg,
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: spacing.sm,
    },
    progressFill: { height: 4, backgroundColor: c.primary, borderRadius: 2 },
    progressLabel: {
      fontSize: fontSizes.xs,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    deckArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    shadowCard: {
      position: 'absolute',
      width: '94%',
      minHeight: 240,
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      transform: [{ scale: 0.95 }, { translateY: 10 }],
      borderWidth: 1,
      borderColor: c.border,
    },
    card: {
      width: '100%',
      minHeight: 260,
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
      overflow: 'hidden',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gotItOverlay: { backgroundColor: 'rgba(34,197,94,0.15)' },
    missedOverlay: { backgroundColor: 'rgba(239,68,68,0.15)' },
    overlayLabel: { fontSize: 28, fontWeight: '800', letterSpacing: 1 },
    gotItLabel: { color: '#16a34a' },
    missedLabel: { color: '#dc2626' },
    sideLabel: {
      fontSize: fontSizes.xs,
      fontWeight: '700',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.md,
    },
    term: {
      fontSize: fontSizes.xl,
      fontWeight: 'bold',
      color: c.text,
      textAlign: 'center',
      lineHeight: 32,
    },
    definition: {
      fontSize: fontSizes.md,
      color: c.text,
      textAlign: 'center',
      lineHeight: 26,
    },
    source: {
      fontSize: fontSizes.xs,
      color: c.textSecondary,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    swipeHint: {
      fontSize: fontSizes.xs,
      color: c.textSecondary,
      marginTop: spacing.lg,
      textAlign: 'center',
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    missedBtn: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1.5, borderColor: '#dc2626' },
    missedBtnText: { fontSize: fontSizes.md, fontWeight: '700', color: '#dc2626' },
    gotItBtn: { backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1.5, borderColor: '#16a34a' },
    gotItBtnText: { fontSize: fontSizes.md, fontWeight: '700', color: '#16a34a' },
    revealBtn: {
      marginHorizontal: spacing.lg,
      marginVertical: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: c.primary,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
    },
    revealBtnText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md },
    emptyTitle: { fontSize: fontSizes.xl, fontWeight: '700', color: c.text, textAlign: 'center' },
    emptyBody: { fontSize: fontSizes.md, color: c.textSecondary, textAlign: 'center', lineHeight: 22 },
    emptyNextDue: { fontSize: fontSizes.sm, color: c.primary, fontWeight: '600', textAlign: 'center' },
    primaryBtn: {
      backgroundColor: c.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    primaryBtnText: { color: '#fff', fontSize: fontSizes.md, fontWeight: '600' },
    outlineBtn: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: c.border,
    },
    outlineBtnText: { color: c.textSecondary, fontSize: fontSizes.md, fontWeight: '500' },
    doneTitle: { fontSize: fontSizes.xxl, fontWeight: '800', color: c.text, textAlign: 'center' },
    statsRow: { flexDirection: 'row', gap: spacing.xl, marginVertical: spacing.md },
    statBox: {
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      minWidth: 90,
      borderWidth: 1,
      borderColor: c.border,
    },
    statNum: { fontSize: fontSizes.xxl, fontWeight: '800', color: c.text },
    statLabel: { fontSize: fontSizes.xs, color: c.textSecondary, marginTop: 2 },
  });

export default function CardsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [phase, setPhase] = useState<Phase>('loading');
  const [dueCards, setDueCards] = useState<LocalCard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [sessionStats, setSessionStats] = useState({ correct: 0, missed: 0 });
  const [nextDue, setNextDue] = useState<number | null>(null);

  // React Native Animated values — stable refs, method calls not flagged by immutability rule
  const [translateX] = useState(() => new Animated.Value(0));
  const [flipScale] = useState(() => new Animated.Value(1));

  // Derived Animated values
  const rotateDeg = translateX.interpolate({
    inputRange: [-220, 0, 220],
    outputRange: ['-18deg', '0deg', '18deg'],
    extrapolate: 'clamp',
  });
  const gotItOpacity = translateX.interpolate({
    inputRange: [0, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const missedOpacity = translateX.interpolate({
    inputRange: [-120, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const currentCard = dueCards[cardIndex];
  const nextCard = dueCards[cardIndex + 1];

  // ------------------------------------------------------------------
  // Sync helpers
  // ------------------------------------------------------------------
  const doSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncService.fullSync();
    } catch {
      // Network unavailable — cached cards remain valid
    } finally {
      setIsSyncing(false);
      const stats = await db.getStats();
      setPendingCount(stats.pending);
    }
  }, []);

  const refreshQueue = useCallback(async () => {
    const cards = await db.getDueCards(50);
    setDueCards(cards);
    setCardIndex(0);
    translateX.setValue(0);
    flipScale.setValue(1);
    setIsFlipped(false);
    if (cards.length === 0) {
      const ts = await db.getNextDueTimestamp();
      setNextDue(ts);
      setPhase('empty');
    } else {
      setPhase('reviewing');
    }
  }, [translateX, flipScale]);

  // ------------------------------------------------------------------
  // Initial load: show cached cards immediately, sync in background
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS === 'web') {
        setPhase('empty');
        return;
      }
      const local = await db.getDueCards(50);
      if (cancelled) return;
      if (local.length > 0) {
        setDueCards(local);
        setPhase('reviewing');
        void doSync();
      } else {
        setPhase('syncing');
        await doSync();
        if (!cancelled) await refreshQueue();
      }
    })();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void doSync();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [doSync, refreshQueue]);

  // ------------------------------------------------------------------
  // Review logic
  // ------------------------------------------------------------------
  const handleSwipe = useCallback(
    (quality: Quality) => {
      const card = dueCards[cardIndex];
      if (!card) return;

      const result = applyReview(
        { easinessFactor: card.easiness_factor, intervalDays: card.interval_days, repetitions: card.repetitions },
        quality,
      );

      void db.updateCardProgress(card.id, result.easinessFactor, result.intervalDays, result.repetitions, result.nextReviewDue);
      void db.addPendingReview(card.id, quality, result.easinessFactor, result.intervalDays, result.repetitions, result.nextReviewDue);

      setSessionStats((s) => ({
        correct: s.correct + (quality === 4 ? 1 : 0),
        missed: s.missed + (quality === 1 ? 1 : 0),
      }));
      setPendingCount((n) => n + 1);

      const next = cardIndex + 1;
      if (next >= dueCards.length) {
        setPhase('done');
      } else {
        setCardIndex(next);
        setIsFlipped(false);
        translateX.setValue(0);
        flipScale.setValue(1);
      }
    },
    [dueCards, cardIndex, translateX, flipScale],
  );

  // Animate card flying off screen, then advance
  const triggerSwipe = useCallback(
    (quality: Quality) => {
      const dir = quality === 4 ? 1 : -1;
      Animated.timing(translateX, { toValue: dir * 700, duration: 250, useNativeDriver: true }).start(
        ({ finished }) => {
          if (!finished) return;
          handleSwipe(quality);
        },
      );
    },
    [translateX, handleSwipe],
  );

  // scaleX: 1→0 (hide), swap content, 0→1 (reveal)
  const revealDefinition = useCallback(() => {
    Animated.timing(flipScale, { toValue: 0, duration: 100, useNativeDriver: true }).start(
      ({ finished }) => {
        if (!finished) return;
        setIsFlipped(true);
        Animated.timing(flipScale, { toValue: 1, duration: 100, useNativeDriver: true }).start();
      },
    );
  }, [flipScale]);

  // ------------------------------------------------------------------
  // Gesture — runs on JS thread (.runOnJS) so it can read isFlipped state
  // and call Animated.Value methods without triggering immutability rule
  // ------------------------------------------------------------------
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onUpdate((e) => {
          if (!isFlipped) return;
          translateX.setValue(e.translationX);
        })
        .onEnd((e) => {
          if (!isFlipped || Math.abs(e.translationX) < SWIPE_THRESHOLD) {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
            return;
          }
          const dir = e.translationX > 0 ? 1 : -1;
          Animated.timing(translateX, { toValue: dir * 700, duration: 250, useNativeDriver: true }).start(
            ({ finished }) => {
              if (!finished) return;
              handleSwipe(dir === 1 ? 4 : 1);
            },
          );
        }),
    [isFlipped, translateX, handleSwipe],
  );

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------
  const progressNum = dueCards.length > 0 ? Math.round((cardIndex / dueCards.length) * 100) : 0;

  if (Platform.OS === 'web') {
    return (
      <ScreenWrapper>
        <View style={styles.centered}>
          <Text style={styles.emptyBody}>Offline review is only available in the mobile app.</Text>
        </View>
      </ScreenWrapper>
    );
  }

  if (phase === 'loading') {
    return (
      <ScreenWrapper>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptyBody}>Loading flashcards…</Text>
        </View>
      </ScreenWrapper>
    );
  }

  if (phase === 'syncing') {
    return (
      <ScreenWrapper>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptyBody}>Syncing your review queue…</Text>
        </View>
      </ScreenWrapper>
    );
  }

  if (phase === 'empty') {
    return (
      <ScreenWrapper>
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>🎉</Text>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptyBody}>You've reviewed everything due today. Great work.</Text>
          {nextDue !== null && (
            <Text style={styles.emptyNextDue}>
              Next review:{' '}
              {new Date(nextDue).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          )}
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/cards/config')}>
            <Text style={styles.primaryBtnText}>Generate More Cards</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={async () => {
              setPhase('syncing');
              await doSync();
              await refreshQueue();
            }}
          >
            <Text style={styles.outlineBtnText}>Sync Again</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  if (phase === 'done') {
    const total = sessionStats.correct + sessionStats.missed;
    const pct = total > 0 ? Math.round((sessionStats.correct / total) * 100) : 0;
    return (
      <ScreenWrapper>
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>{pct >= 80 ? '🌟' : '💪'}</Text>
          <Text style={styles.doneTitle}>Session complete!</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: '#16a34a' }]}>{sessionStats.correct}</Text>
              <Text style={styles.statLabel}>Got it</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: '#dc2626' }]}>{sessionStats.missed}</Text>
              <Text style={styles.statLabel}>Missed</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{pct}%</Text>
              <Text style={styles.statLabel}>Score</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={async () => {
              setSessionStats({ correct: 0, missed: 0 });
              await doSync();
              await refreshQueue();
            }}
          >
            <Text style={styles.primaryBtnText}>{isSyncing ? 'Syncing…' : 'Sync & Continue'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/cards/config')}>
            <Text style={styles.outlineBtnText}>Generate Cards</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  // ------------------------------------------------------------------ reviewing
  return (
    <ScreenWrapper>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Review</Text>
          <View style={styles.headerRight}>
            {isSyncing ? (
              <View style={styles.syncBadge}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : pendingCount > 0 ? (
              <View style={styles.syncBadge}>
                <Text style={styles.syncBadgeText}>{pendingCount} pending sync</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.editButton} onPress={() => router.push('/cards/config')}>
              <Text style={styles.editButtonText}>Material</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressNum}%` as `${number}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {cardIndex} / {dueCards.length} reviewed today
        </Text>

        {/* Card stack */}
        <View style={styles.deckArea}>
          {/* Peeking shadow card */}
          {nextCard && (
            <View style={styles.shadowCard}>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
                <Text style={styles.term} numberOfLines={2}>
                  {nextCard.term}
                </Text>
              </View>
            </View>
          )}

          {/* Current card */}
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.card,
                { transform: [{ translateX }, { rotate: rotateDeg }, { scaleX: flipScale }] },
              ]}
            >
              {/* Direction overlays */}
              <Animated.View style={[styles.overlay, styles.gotItOverlay, { opacity: gotItOpacity }]}>
                <Text style={[styles.overlayLabel, styles.gotItLabel]}>GOT IT ✓</Text>
              </Animated.View>
              <Animated.View style={[styles.overlay, styles.missedOverlay, { opacity: missedOpacity }]}>
                <Text style={[styles.overlayLabel, styles.missedLabel]}>MISSED ✗</Text>
              </Animated.View>

              {/* Card content */}
              {isFlipped ? (
                <>
                  <Text style={styles.sideLabel}>Definition</Text>
                  <Text style={styles.definition}>{currentCard?.definition}</Text>
                  {currentCard?.content_title && (
                    <Text style={styles.source}>{currentCard.content_title}</Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.sideLabel}>Term</Text>
                  <Text style={styles.term}>{currentCard?.term}</Text>
                </>
              )}
            </Animated.View>
          </GestureDetector>

          {isFlipped && (
            <Text style={styles.swipeHint}>← Missed · swipe · Got it →</Text>
          )}
        </View>

        {/* Action row */}
        {isFlipped ? (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.missedBtn]} onPress={() => triggerSwipe(1)}>
              <Text style={styles.missedBtnText}>← Missed</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.gotItBtn]} onPress={() => triggerSwipe(4)}>
              <Text style={styles.gotItBtnText}>Got it →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.revealBtn} onPress={revealDefinition}>
            <Text style={styles.revealBtnText}>Reveal Definition</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenWrapper>
  );
}
