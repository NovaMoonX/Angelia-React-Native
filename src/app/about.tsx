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

/** Approximate height reserved for navigation chrome (dots + arrows + step counter). */
const NAV_CHROME_HEIGHT = 100;

export default function AboutScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleTryDemo = useCallback(() => {
    dispatch(enterDemoMode());
    dispatch(loadDemoUsers(DEMO_DATA.users));
    dispatch(loadDemoChannels(DEMO_DATA.channels));
    dispatch(loadDemoPosts(DEMO_DATA.posts));
    dispatch(loadDemoInvites(DEMO_DATA.invites));
    router.replace('/(protected)/feed');
  }, [dispatch, router]);

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

  const contentHeight = SCREEN_HEIGHT - insets.top - insets.bottom - NAV_CHROME_HEIGHT;

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
            </View>
          );

        case 'problem':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <ScrollView
                contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                showsVerticalScrollIndicator={false}
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
            </View>
          );

        case 'vs-social':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <ScrollView
                contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                showsVerticalScrollIndicator={false}
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
            </View>
          );

        case 'vs-groupchat':
          return (
            <View style={[styles.stepContainer, { width: SCREEN_WIDTH }]}>
              <ScrollView
                contentContainerStyle={[styles.stepContent, { minHeight: contentHeight }]}
                showsVerticalScrollIndicator={false}
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
                  The Full Picture
                </Text>
                <Text style={[styles.stepSubtitle, { color: theme.mutedForeground }]}>
                  Here's how it all stacks up 👇
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
                  Angelia — named after the Greek spirit of messages ✨
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
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Close button + Page dots + navigation */}
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
        data={STEPS}
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

      {/* Step counter + close */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text style={[styles.stepCounter, { color: theme.mutedForeground }]}>
          {currentIndex + 1} of {STEPS.length}
        </Text>
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
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  stepCounter: {
    fontSize: 12,
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
