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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
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
  'daily-circle',
  'custom-circles',
  'your-space',
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
  | 'daily-circle'
  | 'custom-circles'
  | 'your-space'
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
  'daily-circle': 15000,
  'custom-circles': 15000,
  'your-space': 14000,
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
  const params = useLocalSearchParams<{ from?: string; fromApp?: string }>();
  const source = params.from === 'account' ? 'account' : params.from === 'feed' || params.fromApp === '1' ? 'feed' : null;
  const fromApp = source !== null;
  const returnLabel = source === 'account' ? 'Back to Account' : 'Back to Feed';
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ── Auto-play state ───────────────────────────────────────────────────────
  const progressAnim = useSharedValue(0);
  const isAutoPlayingRef = useRef(true);
  const currentIndexRef = useRef(0);
  /** Animation progress value at the moment auto-play was paused (0–1). */
  const pausedProgressRef = useRef(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Mirrors isAutoPlayingRef for rendering the pause/resume button. */
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  /** Seconds remaining until auto-resume (0 when not counting). */
  const [resumeCountdown, setResumeCountdown] = useState(0);

  // Keep currentIndexRef in sync so worklet callbacks read the latest value.
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  /** Scroll to the next step (called from the RN thread via scheduleOnRN). */
  const advanceStep = useCallback(() => {
    const next = currentIndexRef.current + 1;
    if (next < STEPS.length) {
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      // Reached the last step — stop auto-play so the user can act.
      isAutoPlayingRef.current = false;
      setIsAutoPlaying(false);
    }
  }, []);

  /** Clear any running countdown interval and reset countdown state. */
  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setResumeCountdown(0);
  }, []);

  /**
   * Start the progress animation for `stepIndex`, beginning from `fromProgress`
   * (a value 0–1). The remaining duration is proportional to (1 - fromProgress).
   */
  const startProgressFrom = useCallback(
    (stepIndex: number, fromProgress: number) => {
      const totalDuration = STEP_DURATIONS[STEPS[stepIndex]];
      const remainingDuration = Math.round((1 - fromProgress) * totalDuration);
      cancelAnimation(progressAnim);
      progressAnim.value = fromProgress;
      if (remainingDuration <= 0) {
        scheduleOnRN(advanceStep);
        return;
      }
      progressAnim.value = withTiming(1, { duration: remainingDuration, easing: Easing.linear }, (finished) => {
        if (finished) {
          scheduleOnRN(advanceStep);
        }
      });
    },
    [advanceStep, progressAnim]
  );

  /**
   * Pause auto-play (saving progress), start the countdown display, and
   * schedule a resume after RESUME_DELAY_MS of inaction.
   */
  const pauseAndScheduleResume = useCallback(() => {
    // Capture exactly where we are in the current step's animation.
    pausedProgressRef.current = progressAnim.value;
    cancelAnimation(progressAnim);
    isAutoPlayingRef.current = false;
    setIsAutoPlaying(false);

    // (Re-)start the visual countdown.
    clearCountdown();
    let remaining = Math.ceil(RESUME_DELAY_MS / 1000);
    setResumeCountdown(remaining);
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setResumeCountdown(0);
      } else {
        setResumeCountdown(remaining);
      }
    }, 1000);

    // Schedule the actual auto-resume.
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
      isAutoPlayingRef.current = true;
      setIsAutoPlaying(true);
      // Resume from the saved progress on whichever step is current.
      startProgressFrom(currentIndexRef.current, pausedProgressRef.current);
    }, RESUME_DELAY_MS);
  }, [progressAnim, startProgressFrom, clearCountdown]);

  /** Immediately resume auto-play from the saved progress position. */
  const handleResumeNow = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = null;
    clearCountdown();
    isAutoPlayingRef.current = true;
    setIsAutoPlaying(true);
    startProgressFrom(currentIndexRef.current, pausedProgressRef.current);
  }, [clearCountdown, startProgressFrom]);

  /** Manually pause without scheduling an auto-resume. */
  const handleManualPause = useCallback(() => {
    pausedProgressRef.current = progressAnim.value;
    cancelAnimation(progressAnim);
    isAutoPlayingRef.current = false;
    setIsAutoPlaying(false);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = null;
    clearCountdown();
  }, [progressAnim, clearCountdown]);

  /** Restart the entire flow from step 0. */
  const handleRestart = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = null;
    clearCountdown();
    pausedProgressRef.current = 0;
    isAutoPlayingRef.current = true;
    setIsAutoPlaying(true);
    // Scroll directly without triggering pauseAndScheduleResume.
    flatListRef.current?.scrollToIndex({ index: 0, animated: true });
  }, [clearCountdown]);

  // Start / restart progress when the active step changes.
  useEffect(() => {
    // Always reset the progress display for the new step.
    pausedProgressRef.current = 0;
    progressAnim.value = 0;

    if (isAutoPlayingRef.current) {
      startProgressFrom(currentIndex, 0);
    }
    // Deliberately do NOT clear the resume timer here: if the user was paused
    // and navigated to a new step, the timer should still fire on the new step
    // (it will resume from 0 because pausedProgressRef was just reset above).
    return () => {
      cancelAnimation(progressAnim);
    };
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
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
                  {fromApp && (
                    <View style={styles.jumpBox}>
                      <Text style={[styles.jumpLabel, { color: theme.mutedForeground }]}>
                        Confused about circles? Jump straight to their explanation:
                      </Text>
                      <View style={styles.jumpLinks}>
                        <Pressable
                          onPress={() => goToStep(STEPS.indexOf('daily-circle'))}
                          style={[styles.jumpChip, { backgroundColor: theme.secondary }]}
                        >
                          <Text style={[styles.jumpChipText, { color: theme.secondaryForeground }]}>
                            🌞 Daily Circle
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => goToStep(STEPS.indexOf('custom-circles'))}
                          style={[styles.jumpChip, { backgroundColor: theme.secondary }]}
                        >
                          <Text style={[styles.jumpChipText, { color: theme.secondaryForeground }]}>
                            🎯 Custom Circles
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => goToStep(STEPS.indexOf('your-space'))}
                          style={[styles.jumpChip, { backgroundColor: theme.secondary }]}
                        >
                          <Text style={[styles.jumpChipText, { color: theme.secondaryForeground }]}> 
                            📫 Posting in Circles
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
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
                      Circles, Not Chat Rooms
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
                      Posts Expire Automatically
                    </Text>
                    <Text style={[styles.solutionBody, { color: theme.mutedForeground }]}>
                      Your updates fade away naturally — so you can share freely
                      without worrying about building a permanent record.
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
                    Angelia gives you organized, topic-based circles with zero
                    reply pressure. 💆
                  </Text>
                </ScrollView>
              </AnimatedStepContent>
            </View>
          );

        case 'daily-circle':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <AnimatedStepContent isActive={isActive}>
                <ScrollView
                  contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                  showsVerticalScrollIndicator={false}
                  onTouchStart={pauseAndScheduleResume}
                >
                  <Text style={styles.stepEmoji}>🌞</Text>
                  <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                    Your Daily Circle
                  </Text>
                  <Text style={[styles.stepBody, { color: theme.mutedForeground }]}>
                    Your Daily Circle is for the little moments that come up
                    day to day — quick updates, today's mood, a funny thing
                    that happened. No polish needed.
                  </Text>
                  <Text style={[styles.stepBody, { color: theme.mutedForeground }]}>
                    It's a place to share what's real without pretense. A
                    sentence, a photo, a random thought — that's exactly right
                    here. Your people get to just be themselves around you.
                  </Text>
                  <View style={styles.examplePostsContainer}>
                    <View style={[styles.examplePost, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <Text style={styles.examplePostAuthor}>Sarah M.</Text>
                      <Text style={[styles.examplePostText, { color: theme.foreground }]}>finally got the kids to bed before 9 😮‍💨 small win but I'll take it</Text>
                    </View>
                    <View style={[styles.examplePost, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <Text style={styles.examplePostAuthor}>Dad</Text>
                      <Text style={[styles.examplePostText, { color: theme.foreground }]}>Made your grandma's soup recipe today. Turned out pretty good I think 🍲</Text>
                    </View>
                    <View style={[styles.examplePost, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <Text style={styles.examplePostAuthor}>Jordan K.</Text>
                      <Text style={[styles.examplePostText, { color: theme.foreground }]}>rainy morning, good coffee, no complaints ☕</Text>
                    </View>
                  </View>
                </ScrollView>
              </AnimatedStepContent>
            </View>
          );

        case 'custom-circles':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <AnimatedStepContent isActive={isActive}>
                <ScrollView
                  contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                  showsVerticalScrollIndicator={false}
                  onTouchStart={pauseAndScheduleResume}
                >
                  <Text style={styles.stepEmoji}>🎯</Text>
                  <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                    Custom Circles
                  </Text>
                  <Text style={[styles.stepBody, { color: theme.mutedForeground }]}>
                    Create circles for the specific things you want to share —
                    a hobby, a close friend group, a project, photos from a
                    trip. Each circle is its own space.
                  </Text>
                  <Text style={[styles.stepBody, { color: theme.mutedForeground }]}>
                    When people join your Custom Circle, they're choosing to
                    hear about exactly that thing. You give them control over
                    what they want to know more about.
                  </Text>
                  <View style={styles.circleChipsContainer}>
                    <View style={[styles.circleChip, { backgroundColor: theme.card, borderColor: theme.border, alignSelf: 'flex-start' }]}>
                      <Text style={styles.circleChipName}>🏕️ Summer Trip 2025</Text>
                      <Text style={[styles.circleChipDesc, { color: theme.mutedForeground }]}>Photos &amp; updates from the road</Text>
                    </View>
                    <View style={[styles.circleChip, { backgroundColor: theme.card, borderColor: theme.border, alignSelf: 'flex-end' }]}>
                      <Text style={styles.circleChipName}>👶 Baby Updates</Text>
                      <Text style={[styles.circleChipDesc, { color: theme.mutedForeground }]}>For the grandparents &amp; aunts</Text>
                    </View>
                    <View style={[styles.circleChip, { backgroundColor: theme.card, borderColor: theme.border, alignSelf: 'center' }]}>
                      <Text style={styles.circleChipName}>🏋️ Gym Accountability</Text>
                      <Text style={[styles.circleChipDesc, { color: theme.mutedForeground }]}>Just us keeping each other honest</Text>
                    </View>
                    <View style={[styles.circleChip, { backgroundColor: theme.card, borderColor: theme.border, alignSelf: 'flex-start' }]}>
                      <Text style={styles.circleChipName}>🍳 Recipes We Love</Text>
                      <Text style={[styles.circleChipDesc, { color: theme.mutedForeground }]}>Family favorites &amp; new finds</Text>
                    </View>
                  </View>
                </ScrollView>
              </AnimatedStepContent>
            </View>
          );

        case 'your-space':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}> 
              <AnimatedStepContent isActive={isActive}>
                <ScrollView
                  contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                  showsVerticalScrollIndicator={false}
                  onTouchStart={pauseAndScheduleResume}
                >
                  <Text style={styles.stepEmoji}>🫶</Text>
                  <Text style={[styles.stepTitle, { color: theme.foreground }]}> 
                    Your Circle, Your Voice
                  </Text>
                  <Text style={[styles.stepBody, { color: theme.mutedForeground }]}> 
                    Each circle is your space to share what you want, how you
                    want. You set the tone and shape the experience.
                  </Text>
                  <Text style={[styles.stepBody, { color: theme.mutedForeground }]}> 
                    Your people can follow along at their own pace, so updates
                    feel clear, calm, and personal.
                  </Text>
                  <Card style={{ ...styles.yourSpaceCard, borderColor: theme.border, backgroundColor: theme.card }}> 
                    <Text style={styles.yourSpaceCardEmoji}>🌿</Text>
                    <Text style={[styles.yourSpaceCardTitle, { color: theme.foreground }]}>You create the experience</Text>
                    <Text style={[styles.yourSpaceCardBody, { color: theme.mutedForeground }]}> 
                      Share out what matters. Your circle receives it in one
                      simple, focused place.
                    </Text>
                  </Card>
                  <Card style={{ ...styles.yourSpaceCard, borderColor: theme.border, backgroundColor: theme.card }}>
                    <Text style={styles.yourSpaceCardEmoji}>🔒</Text>
                    <Text style={[styles.yourSpaceCardTitle, { color: theme.foreground }]}>Posting stays with you</Text>
                    <Text style={[styles.yourSpaceCardBody, { color: theme.mutedForeground }]}>
                      Members can follow and receive your updates, but they
                      cannot post in your circle (at least for now).
                    </Text>
                  </Card>
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
          if (fromApp) {
            return (
              <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
                <AnimatedStepContent isActive={isActive}>
                  <View style={[styles.stepContent, styles.ctaStep, { minHeight: contentHeight }]}>
                    <Text style={styles.stepEmoji}>✨</Text>
                    <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                      Now you know!
                    </Text>
                    <Text style={[styles.stepSubtitle, { color: theme.mutedForeground }]}>
                      Go share something with your circles.
                    </Text>
                    <View style={styles.ctaButtons}>
                      <Button
                        onPress={() => router.back()}
                        size="lg"
                        style={{ width: '100%' }}
                      >
                        {returnLabel}
                      </Button>
                    </View>
                  </View>
                </AnimatedStepContent>
              </View>
            );
          }
          
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
    [theme, contentHeight, router, dispatch, handleTryDemo, currentIndex, pauseAndScheduleResume, fromApp, source, returnLabel]
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

      {/* Bottom bar — Left control + Close */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {currentIndex === STEPS.length - 1 ? (
          /* On the last step: offer a restart */
          <Pressable onPress={handleRestart} style={styles.controlButton}>
            <Feather name="refresh-cw" size={15} color={theme.primary} />
            <Text style={[styles.controlButtonText, { color: theme.primary }]}>Restart</Text>
          </Pressable>
        ) : isAutoPlaying ? (
          /* Auto-play running: show pause button */
          <Pressable onPress={handleManualPause} style={styles.controlButton}>
            <Feather name="pause" size={15} color={theme.mutedForeground} />
          </Pressable>
        ) : (
          /* Auto-play paused: show resume button + countdown */
          <Pressable onPress={handleResumeNow} style={styles.controlButton}>
            <Feather name="play" size={15} color={theme.primary} />
            {resumeCountdown > 0 && (
              <Text style={[styles.controlButtonText, { color: theme.mutedForeground }]}>
                {resumeCountdown}s
              </Text>
            )}
          </Pressable>
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    minWidth: 40,
  },
  controlButtonText: {
    fontSize: 13,
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
  jumpBox: {
    marginTop: 20,
    alignItems: 'center',
    gap: 10,
  },
  jumpLabel: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    paddingBlockEnd: 4,
  },
  jumpLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  jumpChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  jumpChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Daily Circle examples
  examplePostsContainer: {
    marginTop: 16,
    gap: 10,
    width: '100%',
  },
  examplePost: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  examplePostAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
  },
  examplePostText: {
    fontSize: 13,
    lineHeight: 19,
  },
  // Custom Circles examples
  circleChipsContainer: {
    marginTop: 16,
    gap: 10,
    width: '100%',
  },
  circleChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '80%',
    gap: 2,
  },
  circleChipName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
  },
  circleChipDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  // Your space step
  yourSpaceCard: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  yourSpaceCardEmoji: {
    fontSize: 22,
  },
  yourSpaceCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  yourSpaceCardBody: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
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
