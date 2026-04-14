import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ComparisonTable } from '@/components/ComparisonTable';
import { useTheme } from '@/hooks/useTheme';
import { useAppDispatch } from '@/store/hooks';
import { enterDemoMode } from '@/store/slices/demoSlice';
import { loadDemoPosts } from '@/store/slices/postsSlice';
import { loadDemoChannels } from '@/store/slices/channelsSlice';
import { loadDemoUsers } from '@/store/slices/usersSlice';
import { loadDemoInvites } from '@/store/slices/invitesSlice';
import { DEMO_DATA } from '@/lib/demoData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ARCHETYPES = [
  {
    emoji: '👴',
    title: 'Grandparents Far Away',
    desc: 'They want to see the grandkids grow up — without learning a new app every week.',
  },
  {
    emoji: '💼',
    title: 'The Busy Professional',
    desc: 'Always on the go, catching up on family stuff during a lunch break or commute.',
  },
  {
    emoji: '👨‍👩‍👧',
    title: 'The Busy Parent',
    desc: 'Wants to share moments with family without the pressure of performing for strangers.',
  },
  {
    emoji: '🌍',
    title: 'Family Across the World',
    desc: 'Different time zones, different schedules — but still wanting to stay connected.',
  },
];

const STEPS: Step[] = [
  'intro',
  'problem',
  'solution',
  'personas',
  'vs-social',
  'vs-groupchat',
  'compare',
  'start',
];
type Step =
  | 'intro'
  | 'problem'
  | 'solution'
  | 'personas'
  | 'vs-social'
  | 'vs-groupchat'
  | 'compare'
  | 'start';

/** Approximate height reserved for navigation chrome (indicators + arrows + bottom bar). */
const NAV_CHROME_HEIGHT = 100;

/** Duration each step is displayed before auto-advancing (ms). */
const STEP_DURATIONS: Record<Step, number> = {
  intro: 13000,
  problem: 15000,
  solution: 18000,
  personas: 15000,
  'vs-social': 16000,
  'vs-groupchat': 16000,
  compare: 18000,
  start: 15000,
};

/** Width of the active step's progress pill indicator (px). */
const ACTIVE_PILL_WIDTH = 40;

/** After user interaction, auto-play resumes after this many ms. */
const RESUME_DELAY_MS = 10_000;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated fill inside the active step's progress indicator pill. */
function ProgressFill({
  progressAnim,
  color,
}: {
  progressAnim: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => ({
    width: progressAnim.value * ACTIVE_PILL_WIDTH,
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color, borderRadius: 4 }, style]} />;
}

/** Wraps a step's scrollable content and fades+slides it in when the step becomes active. */
function AnimatedStepContent({
  isActive,
  children,
}: {
  isActive: boolean;
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    if (isActive) {
      opacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
      translateY.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) });
    } else {
      // Reset so the animation replays if the user navigates back to this step.
      opacity.value = 0;
      translateY.value = 24;
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
    flex: 1,
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function AboutScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ── Auto-play state ───────────────────────────────────────────────────────
  const progressAnim = useSharedValue(0);
  const isAutoPlayingRef = useRef(true);
  const currentIndexRef = useRef(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep currentIndexRef in sync so worklet callbacks read the latest value.
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  /** Scroll to the next step (called from the UI thread via runOnJS). */
  const advanceStep = useCallback(() => {
    const next = currentIndexRef.current + 1;
    if (next < STEPS.length) {
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      // Reached the last step — stop auto-play so the user can act.
      isAutoPlayingRef.current = false;
    }
  }, []);

  /** Start the progress animation + auto-advance timer for the given step. */
  const startProgress = useCallback(
    (stepIndex: number) => {
      const duration = STEP_DURATIONS[STEPS[stepIndex]];
      cancelAnimation(progressAnim);
      progressAnim.value = 0;
      progressAnim.value = withTiming(1, { duration, easing: Easing.linear }, (finished) => {
        if (finished) {
          runOnJS(advanceStep)();
        }
      });
    },
    [advanceStep, progressAnim]
  );

  /** Pause auto-play and schedule a resume after RESUME_DELAY_MS of inaction. */
  const pauseAndScheduleResume = useCallback(() => {
    isAutoPlayingRef.current = false;
    cancelAnimation(progressAnim);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      isAutoPlayingRef.current = true;
      startProgress(currentIndexRef.current);
    }, RESUME_DELAY_MS);
  }, [progressAnim, startProgress]);

  // Start / restart progress when the active step changes.
  useEffect(() => {
    if (isAutoPlayingRef.current) {
      startProgress(currentIndex);
    }
    return () => {
      cancelAnimation(progressAnim);
      // Clear any pending resume timer so it doesn't fire for a stale step.
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      cancelAnimation(progressAnim);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ── End auto-play ─────────────────────────────────────────────────────────

  const handleTryDemo = useCallback(() => {
    dispatch(enterDemoMode());
    dispatch(loadDemoUsers(DEMO_DATA.users));
    dispatch(loadDemoChannels(DEMO_DATA.channels));
    dispatch(loadDemoPosts(DEMO_DATA.posts));
    dispatch(loadDemoInvites(DEMO_DATA.invites));
    router.replace('/(protected)/feed');
  }, [dispatch, router]);

  const goToStep = useCallback(
    (index: number) => {
      pauseAndScheduleResume();
      flatListRef.current?.scrollToIndex({ index, animated: true });
    },
    [pauseAndScheduleResume]
  );

  const goNext = useCallback(() => {
    if (currentIndex < STEPS.length - 1) {
      goToStep(currentIndex + 1);
    }
  }, [currentIndex, goToStep]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      goToStep(currentIndex - 1);
    }
  }, [currentIndex, goToStep]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const contentHeight = SCREEN_HEIGHT - insets.top - insets.bottom - NAV_CHROME_HEIGHT;

  const renderStep = useCallback(
    ({ item, index }: { item: Step; index: number }) => {
      const isActive = index === currentIndex;
      switch (item) {
        case 'intro':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <AnimatedStepContent isActive={isActive}>
                <ScrollView
                  contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                  showsVerticalScrollIndicator={false}
                  onTouchStart={pauseAndScheduleResume}
                >
                  <Text style={styles.stepEmoji}>✉️</Text>
                  <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                    What is Angelia?
                  </Text>
                  <Text style={[styles.stepBody, { color: theme.mutedForeground }]}>
                    A private space for your family and close friends to share
                    what matters — updates, photos, milestones 📸
                  </Text>
                  <Text style={[styles.stepBody, { color: theme.mutedForeground }]}>
                    No algorithms. No followers. No noise. Just your people. 💛
                  </Text>
                  <View style={styles.highlightBox}>
                    <Text style={[styles.highlightText, { color: theme.primary }]}>
                      "Family updates without the noise.{'\n'}Curate, subscribe, connect."
                    </Text>
                  </View>
                </ScrollView>
              </AnimatedStepContent>
            </View>
          );

        case 'problem':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <AnimatedStepContent isActive={isActive}>
                <ScrollView
                  contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                  showsVerticalScrollIndicator={false}
                  onTouchStart={pauseAndScheduleResume}
                >
                  <Text style={styles.stepEmoji}>🤔</Text>
                  <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                    Sound familiar?
                  </Text>
                  <Card style={{ ...styles.problemCard, borderLeftColor: theme.destructive }}>
                      <Text style={[styles.problemBody, { color: theme.mutedForeground }]}>
                        📤 You end up sharing the same update across multiple
                        groups and still aren't sure who you've told.
                      </Text>
                  </Card>
                  <Card style={{ ...styles.problemCard, borderLeftColor: theme.destructive }}>
                    <Text style={[styles.problemBody, { color: theme.mutedForeground }]}>
                      🔔 Notifications pile up. Important stuff gets buried
                      under memes and "who's bringing what" messages.
                    </Text>
                  </Card>
                  <Card style={{ ...styles.problemCard, borderLeftColor: theme.destructive }}>
                    <Text style={[styles.problemBody, { color: theme.mutedForeground }]}>
                      😓 Sharing on social media feels like performing.
                      Group chats feel like shouting into the void.
                    </Text>
                  </Card>
                </ScrollView>
              </AnimatedStepContent>
            </View>
          );

        case 'solution':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <AnimatedStepContent isActive={isActive}>
                <ScrollView
                  contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                  showsVerticalScrollIndicator={false}
                  onTouchStart={pauseAndScheduleResume}
                >
                  <Text style={styles.stepEmoji}>💡</Text>
                  <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                    How Angelia Works
                  </Text>
                  <Card style={styles.solutionCard}>
                    <Text style={styles.solutionIcon}>📢</Text>
                    <Text style={[styles.solutionTitle, { color: theme.foreground }]}>
                      Channels, Not Chat Rooms
                    </Text>
                    <Text style={[styles.solutionBody, { color: theme.mutedForeground }]}>
                      Organize updates by topic — "Kids' Milestones," "Travel
                      Photos," "Daily Life." People pick what they want to follow.
                    </Text>
                  </Card>
                  <Card style={styles.solutionCard}>
                    <Text style={styles.solutionIcon}>🕰️</Text>
                    <Text style={[styles.solutionTitle, { color: theme.foreground }]}>
                      Read It When You Can
                    </Text>
                    <Text style={[styles.solutionBody, { color: theme.mutedForeground }]}>
                      No pressure to reply right away (or at all). Check in when
                      it works for you. Life doesn't wait for read receipts.
                    </Text>
                  </Card>
                  <Card style={styles.solutionCard}>
                    <Text style={styles.solutionIcon}>⏳</Text>
                    <Text style={[styles.solutionTitle, { color: theme.foreground }]}>
                      Posts Expire After 6 Months
                    </Text>
                    <Text style={[styles.solutionBody, { color: theme.mutedForeground }]}>
                      This keeps things fresh and real. Share in the moment
                      without worrying about a permanent record.
                    </Text>
                  </Card>
                </ScrollView>
              </AnimatedStepContent>
            </View>
          );

        case 'personas':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <AnimatedStepContent isActive={isActive}>
                <ScrollView
                  contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                  showsVerticalScrollIndicator={false}
                  onTouchStart={pauseAndScheduleResume}
                >
                  <Text style={styles.stepEmoji}>👥</Text>
                  <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                    Who It's For
                  </Text>
                  <Text style={[styles.stepSubtitle, { color: theme.mutedForeground }]}>
                    If any of these sound like you (or someone you love) 👇
                  </Text>
                  {ARCHETYPES.map((persona) => (
                    <View key={persona.title} style={styles.personaRow}>
                      <Text style={styles.personaEmoji}>{persona.emoji}</Text>
                      <View style={styles.personaText}>
                        <Text style={[styles.personaTitle, { color: theme.foreground }]}>
                          {persona.title}
                        </Text>
                        <Text style={[styles.personaDesc, { color: theme.mutedForeground }]}>
                          {persona.desc}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </AnimatedStepContent>
            </View>
          );

        case 'vs-social':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <AnimatedStepContent isActive={isActive}>
                <ScrollView
                  contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                  showsVerticalScrollIndicator={false}
                  onTouchStart={pauseAndScheduleResume}
                >
                  <Text style={styles.stepEmoji}>📣</Text>
                  <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                    Not Social Media
                  </Text>
                  <Text style={[styles.stepBody, { color: theme.mutedForeground }]}>
                    Social media is built around followers, likes, and algorithms
                    that decide what you see. 🎰
                  </Text>
                  <Text style={[styles.stepBody, { color: theme.foreground, fontWeight: '700' }]}>
                    The downside:
                  </Text>
                  <Card style={styles.vsCard}>
                    <Text style={[styles.vsPoint, { color: theme.mutedForeground }]}>
                      ❌  Algorithms decide who sees your post
                    </Text>
                    <Text style={[styles.vsPoint, { color: theme.mutedForeground }]}>
                      ❌  Strangers mixed in with family
                    </Text>
                    <Text style={[styles.vsPoint, { color: theme.mutedForeground }]}>
                      ❌  Pressure to perform and get engagement
                    </Text>
                  </Card>
                  <Text style={[styles.stepBody, { color: theme.mutedForeground }]}>
                    With Angelia, your updates go directly to the people who
                    care — no middleman. ✅
                  </Text>
                </ScrollView>
              </AnimatedStepContent>
            </View>
          );

        case 'vs-groupchat':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <AnimatedStepContent isActive={isActive}>
                <ScrollView
                  contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                  showsVerticalScrollIndicator={false}
                  onTouchStart={pauseAndScheduleResume}
                >
                  <Text style={styles.stepEmoji}>💬</Text>
                  <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                    Not Another Group Chat
                  </Text>
                  <Text style={[styles.stepBody, { color: theme.mutedForeground }]}>
                    Group chats are great for quick coordination, but terrible
                    for meaningful updates. 🫠
                  </Text>
                  <Text style={[styles.stepBody, { color: theme.foreground, fontWeight: '700' }]}>
                    The downside:
                  </Text>
                  <Card style={styles.vsCard}>
                    <Text style={[styles.vsPoint, { color: theme.mutedForeground }]}>
                      ❌  Important updates get buried in chatter
                    </Text>
                    <Text style={[styles.vsPoint, { color: theme.mutedForeground }]}>
                      ❌  Everyone's always expected to reply
                    </Text>
                    <Text style={[styles.vsPoint, { color: theme.mutedForeground }]}>
                      ❌  Can't organize by topic
                    </Text>
                  </Card>
                  <Text style={[styles.stepBody, { color: theme.mutedForeground }]}>
                    Angelia gives you organized, topic-based channels with zero
                    reply pressure. 💆
                  </Text>
                </ScrollView>
              </AnimatedStepContent>
            </View>
          );

        case 'compare':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <AnimatedStepContent isActive={isActive}>
                <ScrollView
                  contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                  showsVerticalScrollIndicator={false}
                  onTouchStart={pauseAndScheduleResume}
                >
                  <Text style={styles.stepEmoji}>⚖️</Text>
                  <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                    The Full Picture
                  </Text>
                  <Text style={[styles.stepSubtitle, { color: theme.mutedForeground }]}>
                    Here's how it all stacks up 👇
                  </Text>
                  <ComparisonTable />
                </ScrollView>
              </AnimatedStepContent>
            </View>
          );

        case 'start':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <AnimatedStepContent isActive={isActive}>
                <View style={[styles.stepContent, styles.ctaStep, { minHeight: contentHeight }]}>
                  <Text style={styles.stepEmoji}>🚀</Text>
                  <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                    Ready to Try It?
                  </Text>
                  <Text style={[styles.stepSubtitle, { color: theme.mutedForeground }]}>
                    Start with a demo or create your account.
                  </Text>
                  <View style={styles.ctaButtons}>
                    <Button onPress={() => router.push('/auth')} size="lg" style={{ width: '100%' }}>
                      Get Started
                    </Button>
                    <Pressable
                      onPress={handleTryDemo}
                      style={[styles.demoButton, { backgroundColor: theme.secondary }]}
                    >
                      <Text style={styles.demoEmoji}>🎭</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.demoTitle, { color: theme.secondaryForeground }]}>
                          Try Demo Mode
                        </Text>
                        <Text style={[styles.demoDesc, { color: theme.secondaryForeground }]}>
                          Explore with sample data — no sign up
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={20} color={theme.secondaryForeground} />
                    </Pressable>
                  </View>
                  <Text style={[styles.footerText, { color: theme.mutedForeground }]}>
                    Angelia — named after the Greek spirit of messages ✨
                  </Text>
                </View>
              </AnimatedStepContent>
            </View>
          );

        default:
          return null;
      }
    },
    [theme, contentHeight, router, dispatch, handleTryDemo, currentIndex, pauseAndScheduleResume]
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Indicators + navigation arrows */}
      <View style={styles.navRow}>
        <Pressable
          onPress={goPrev}
          style={[styles.navArrow, currentIndex === 0 && styles.navArrowHidden]}
          disabled={currentIndex === 0}
        >
          <Feather name="chevron-left" size={24} color={theme.foreground} />
        </Pressable>

        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <Pressable key={i} onPress={() => goToStep(i)} hitSlop={6}>
              {i === currentIndex ? (
                <View style={[styles.progressPill, { backgroundColor: theme.muted }]}>
                  <ProgressFill progressAnim={progressAnim} color={theme.primary} />
                </View>
              ) : (
                <View style={[styles.dot, { backgroundColor: theme.muted }]} />
              )}
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={goNext}
          style={[styles.navArrow, currentIndex === STEPS.length - 1 && styles.navArrowHidden]}
          disabled={currentIndex === STEPS.length - 1}
        >
          <Feather name="chevron-right" size={24} color={theme.foreground} />
        </Pressable>
      </View>

      {/* Horizontal pager */}
      <FlatList
        ref={flatListRef}
        data={STEPS}
        keyExtractor={(item) => item}
        renderItem={renderStep}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollBeginDrag={pauseAndScheduleResume}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Bottom bar — Close only */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable onPress={() => router.back()} style={styles.closeLink}>
          <Text style={[styles.closeLinkText, { color: theme.primary }]}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navArrow: {
    padding: 4,
  },
  navArrowHidden: {
    opacity: 0,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressPill: {
    width: ACTIVE_PILL_WIDTH,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bottomBar: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  closeLink: {
    padding: 4,
  },
  closeLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepContainer: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 16,
  },
  stepEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  stepBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  highlightBox: {
    marginTop: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  highlightText: {
    fontSize: 16,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 24,
  },
  // Problem step
  problemCard: {
    padding: 16,
    borderLeftWidth: 3,
    width: '100%',
  },
  problemBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  // Solution step
  solutionCard: {
    padding: 16,
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  solutionIcon: {
    fontSize: 28,
  },
  solutionTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  solutionBody: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  // Personas step
  personaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 8,
  },
  personaEmoji: {
    fontSize: 36,
  },
  personaText: {
    flex: 1,
    gap: 2,
  },
  personaTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  personaDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  // VS steps
  vsCard: {
    padding: 16,
    width: '100%',
    gap: 10,
  },
  vsPoint: {
    fontSize: 14,
    lineHeight: 22,
  },
  // CTA step
  ctaStep: {
    justifyContent: 'center',
  },
  ctaButtons: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  demoEmoji: {
    fontSize: 28,
  },
  demoTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  demoDesc: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  },
  footerText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 16,
  },
});
