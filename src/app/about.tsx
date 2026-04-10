import React, { useRef, useState, useCallback } from 'react';
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
    title: 'The Remote Elder',
    desc: 'Grandparents who want daily connection without tech friction.',
  },
  {
    emoji: '💼',
    title: 'The Global Professional',
    desc: 'Busy individuals catching up on family during downtime.',
  },
  {
    emoji: '👨‍👩‍👧',
    title: 'The Saturated Parent',
    desc: 'Parents who share moments without performance pressure.',
  },
  {
    emoji: '🌍',
    title: 'The Diaspora Connector',
    desc: 'Families spread across time zones, staying in the loop.',
  },
];

const STEPS = ['intro', 'problem', 'solution', 'personas', 'compare', 'start'] as const;
type Step = typeof STEPS[number];

export default function AboutScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleTryDemo = () => {
    dispatch(enterDemoMode());
    dispatch(loadDemoUsers(DEMO_DATA.users));
    dispatch(loadDemoChannels(DEMO_DATA.channels));
    dispatch(loadDemoPosts(DEMO_DATA.posts));
    dispatch(loadDemoInvites(DEMO_DATA.invites));
    router.replace('/(protected)/feed');
  };

  const goToStep = useCallback((index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
  }, []);

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

  const contentHeight = SCREEN_HEIGHT - insets.top - insets.bottom - 100; // 100 for header + dots + nav

  const renderStep = useCallback(
    ({ item }: { item: Step }) => {
      switch (item) {
        case 'intro':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <ScrollView
                contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.stepEmoji}>✉️</Text>
                <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                  What is Angelia?
                </Text>
                <Text style={[styles.stepBody, { color: theme.mutedForeground }]}>
                  Angelia is a private, family-first communication app built around
                  channels — not group chats.
                </Text>
                <Text style={[styles.stepBody, { color: theme.mutedForeground }]}>
                  Share life updates, photos, and milestones with the people who
                  matter most. No algorithms, no followers, no noise.
                </Text>
                <Text style={[styles.stepBody, { color: theme.mutedForeground }]}>
                  Just intentional connection with your close circle.
                </Text>
                <View style={styles.highlightBox}>
                  <Text style={[styles.highlightText, { color: theme.primary }]}>
                    "Family updates without the noise.{'\n'}Curate, subscribe, connect."
                  </Text>
                </View>
              </ScrollView>
            </View>
          );

        case 'problem':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <ScrollView
                contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.stepEmoji}>🌪️</Text>
                <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                  The Problem
                </Text>
                <Card style={{ ...styles.problemCard, borderLeftColor: theme.destructive }}>
                  <Text style={[styles.problemTitle, { color: theme.foreground }]}>
                    The Connectivity Paradox
                  </Text>
                  <Text style={[styles.problemBody, { color: theme.mutedForeground }]}>
                    We have more ways to communicate than ever before, yet meaningful
                    connection keeps slipping through the noise. Group chats overflow.
                    Notifications pile up. Our most important relationships get lost in
                    the digital storm.
                  </Text>
                </Card>
                <Card style={{ ...styles.problemCard, borderLeftColor: theme.destructive }}>
                  <Text style={[styles.problemTitle, { color: theme.foreground }]}>
                    Synchronous Noise
                  </Text>
                  <Text style={[styles.problemBody, { color: theme.mutedForeground }]}>
                    Modern messaging assumes everyone is available all the time. This
                    "always-on" expectation creates anxiety and guilt. Conversations get
                    buried. Context gets lost. People stop sharing because it feels like
                    shouting into a void.
                  </Text>
                </Card>
              </ScrollView>
            </View>
          );

        case 'solution':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <ScrollView
                contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.stepEmoji}>💡</Text>
                <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                  How Angelia Works
                </Text>
                <Card style={styles.solutionCard}>
                  <Text style={styles.solutionIcon}>📢</Text>
                  <Text style={[styles.solutionTitle, { color: theme.foreground }]}>
                    Channel-Based Sharing
                  </Text>
                  <Text style={[styles.solutionBody, { color: theme.mutedForeground }]}>
                    Share through channels, not chat rooms. Curate updates by topic —
                    "Kids' Milestones," "Travel Photos," "Daily Life." Subscribers choose
                    what to follow.
                  </Text>
                </Card>
                <Card style={styles.solutionCard}>
                  <Text style={styles.solutionIcon}>🕰️</Text>
                  <Text style={[styles.solutionTitle, { color: theme.foreground }]}>
                    Asynchronous by Design
                  </Text>
                  <Text style={[styles.solutionBody, { color: theme.mutedForeground }]}>
                    No pressure to respond immediately — or at all. Read at your own
                    pace. Share when you're ready. Life doesn't wait for read receipts.
                  </Text>
                </Card>
                <Card style={styles.solutionCard}>
                  <Text style={styles.solutionIcon}>⏳</Text>
                  <Text style={[styles.solutionTitle, { color: theme.foreground }]}>
                    The 180-Day Rule
                  </Text>
                  <Text style={[styles.solutionBody, { color: theme.mutedForeground }]}>
                    Every post expires after 6 months. This encourages authentic,
                    in-the-moment sharing. Life moves forward — your communication
                    should too.
                  </Text>
                </Card>
              </ScrollView>
            </View>
          );

        case 'personas':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <ScrollView
                contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.stepEmoji}>👥</Text>
                <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                  Sound Familiar?
                </Text>
                <Text style={[styles.stepSubtitle, { color: theme.mutedForeground }]}>
                  Angelia is for people like you — and your close circle.
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
            </View>
          );

        case 'compare':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <ScrollView
                contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.stepEmoji}>⚖️</Text>
                <Text style={[styles.stepTitle, { color: theme.foreground }]}>
                  How It Compares
                </Text>
                <Text style={[styles.stepSubtitle, { color: theme.mutedForeground }]}>
                  See where Angelia fills the gap.
                </Text>
                <ComparisonTable />
              </ScrollView>
            </View>
          );

        case 'start':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
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
                  Angelia — named after the Greek spirit of messages.
                </Text>
              </View>
            </View>
          );

        default:
          return null;
      }
    },
    [theme, contentHeight, router, dispatch, handleTryDemo]
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Page dots + navigation */}
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
            <Pressable
              key={i}
              onPress={() => goToStep(i)}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === currentIndex ? theme.primary : theme.muted,
                },
              ]}
            />
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
        data={STEPS as unknown as Step[]}
        keyExtractor={(item) => item}
        renderItem={renderStep}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Step counter */}
      <Text style={[styles.stepCounter, { color: theme.mutedForeground }]}>
        {currentIndex + 1} of {STEPS.length}
      </Text>
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
  stepCounter: {
    textAlign: 'center',
    fontSize: 12,
    paddingBottom: 8,
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
  problemTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  problemBody: {
    fontSize: 13,
    lineHeight: 20,
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
