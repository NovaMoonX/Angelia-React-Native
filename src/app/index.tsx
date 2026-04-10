import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AngeliaLogo } from '@/components/AngeliaLogo';
import { ComparisonTable } from '@/components/ComparisonTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
import { useTheme } from '@/hooks/useTheme';
import { useAppDispatch } from '@/store/hooks';
import { enterDemoMode } from '@/store/slices/demoSlice';
import { loadDemoPosts } from '@/store/slices/postsSlice';
import { loadDemoChannels } from '@/store/slices/channelsSlice';
import { loadDemoUsers } from '@/store/slices/usersSlice';
import { loadDemoInvites } from '@/store/slices/invitesSlice';
import { DEMO_DATA } from '@/lib/demoData';

const SPLASH_TO_ACTIONS_DELAY = 600;

const ARCHETYPES = [
  {
    emoji: '👴',
    title: 'The Remote Elder',
    question: 'Do you have grandparents who want daily connection without tech friction?',
    benefit: 'Angelia lets them receive curated updates — no group chat clutter, no missed messages.',
  },
  {
    emoji: '💼',
    title: 'The Global Professional',
    question: 'Are you always busy and catching up on family during downtime?',
    benefit: 'Subscribe to channels that matter. Read at your own pace. Zero reply pressure.',
  },
  {
    emoji: '👨‍👩‍👧',
    title: 'The Saturated Parent',
    question: 'Do you want to share moments without the performance pressure of social media?',
    benefit: 'Share authentically with family. No likes, no followers, no algorithm. Just real connection.',
  },
  {
    emoji: '🌍',
    title: 'The Diaspora Connector',
    question: 'Is your family spread across different time zones and countries?',
    benefit: 'Asynchronous updates mean everyone stays in the loop — whether they check in at 6 AM or midnight.',
  },
];

const ABOUT_SECTIONS = [
  {
    title: 'The Connectivity Paradox',
    content:
      'We have more ways to communicate than ever, yet meaningful connection keeps slipping through the noise.',
  },
  {
    title: 'Categorical Agency',
    content:
      'Angelia reimagines family communication through channels, not chat rooms. Share on your terms. Subscribe to what matters.',
  },
  {
    title: 'The 180-Day Rule',
    content:
      'Every post expires after 6 months. This encourages authentic, in-the-moment sharing. Life moves forward — your communication should too.',
  },
];

type Screen = 'splash' | 'actions' | 'learn-more';

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>('splash');

  // Animations
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const sloganOpacity = useRef(new Animated.Value(0)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const actionsTranslateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    // Splash entrance animation
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(sloganOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After splash animations, transition to actions
      setTimeout(() => {
        setScreen('actions');
        Animated.parallel([
          Animated.timing(actionsOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.spring(actionsTranslateY, {
            toValue: 0,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]).start();
      }, SPLASH_TO_ACTIONS_DELAY);
    });
  }, []);

  const handleGetStarted = () => {
    router.push('/auth');
  };

  const handleTryDemo = () => {
    dispatch(enterDemoMode());
    dispatch(loadDemoUsers(DEMO_DATA.users));
    dispatch(loadDemoChannels(DEMO_DATA.channels));
    dispatch(loadDemoPosts(DEMO_DATA.posts));
    dispatch(loadDemoInvites(DEMO_DATA.invites));
    router.replace('/(protected)/feed');
  };

  const handleLearnMore = () => {
    setScreen('learn-more');
  };

  if (screen === 'learn-more') {
    return (
      <View style={[styles.fullScreen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={styles.learnMoreContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <Pressable
            onPress={() => setScreen('actions')}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={20} color={theme.foreground} />
            <Text style={[styles.backText, { color: theme.foreground }]}>Back</Text>
          </Pressable>

          <Text style={[styles.learnMoreTitle, { color: theme.foreground }]}>
            Does this sound like you?
          </Text>
          <Text style={[styles.learnMoreSubtitle, { color: theme.mutedForeground }]}>
            See if Angelia is the right fit for you and your close circle.
          </Text>

          {/* Archetypes */}
          {ARCHETYPES.map((archetype) => (
            <Card key={archetype.title} style={styles.archetypeCard}>
              <Text style={styles.archetypeEmoji}>{archetype.emoji}</Text>
              <Text style={[styles.archetypeTitle, { color: theme.foreground }]}>
                {archetype.title}
              </Text>
              <Text style={[styles.archetypeQuestion, { color: theme.primary }]}>
                {archetype.question}
              </Text>
              <Text style={[styles.archetypeBenefit, { color: theme.mutedForeground }]}>
                {archetype.benefit}
              </Text>
            </Card>
          ))}

          <Separator style={{ marginVertical: 24 }} />

          {/* What makes Angelia different */}
          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
            How is Angelia different?
          </Text>
          <ComparisonTable />

          <Separator style={{ marginVertical: 24 }} />

          {/* About sections */}
          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
            The Angelia Philosophy
          </Text>
          {ABOUT_SECTIONS.map((section) => (
            <Card key={section.title} style={styles.aboutCard}>
              <Text style={[styles.aboutCardTitle, { color: theme.foreground }]}>
                {section.title}
              </Text>
              <Text style={[styles.aboutCardContent, { color: theme.mutedForeground }]}>
                {section.content}
              </Text>
            </Card>
          ))}

          {/* CTA at bottom */}
          <View style={styles.learnMoreCta}>
            <Text style={[styles.learnMoreCtaText, { color: theme.foreground }]}>
              Ready to try it?
            </Text>
            <Button onPress={handleGetStarted} style={{ marginBottom: 12 }}>
              Get Started
            </Button>
            <Button variant="secondary" onPress={handleTryDemo}>
              🎭 Try Demo Mode
            </Button>
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={[styles.footerText, { color: theme.mutedForeground }]}>
              Angelia — named after the Greek spirit of messages.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fullScreen,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* Centered splash content */}
      <View style={styles.splashCenter}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <AngeliaLogo size={80} />
        </Animated.View>

        <Animated.Text
          style={[
            styles.heroTitle,
            { color: theme.foreground, opacity: titleOpacity },
          ]}
        >
          Angelia
        </Animated.Text>

        <Animated.Text
          style={[
            styles.heroSubtitle,
            { color: theme.mutedForeground, opacity: sloganOpacity },
          ]}
        >
          Family updates without the noise.{'\n'}Curate, subscribe, connect.
        </Animated.Text>
      </View>

      {/* Action buttons that animate in */}
      {screen === 'actions' && (
        <Animated.View
          style={[
            styles.actionsContainer,
            {
              opacity: actionsOpacity,
              transform: [{ translateY: actionsTranslateY }],
            },
          ]}
        >
          <Button onPress={handleGetStarted} size="lg" style={styles.actionButton}>
            Get Started
          </Button>

          <Button variant="outline" onPress={() => router.push('/auth')} size="lg" style={styles.actionButton}>
            Sign In
          </Button>

          <Pressable onPress={handleTryDemo} style={[styles.demoButton, { backgroundColor: theme.secondary }]}>
            <Text style={styles.demoEmoji}>🎭</Text>
            <View style={styles.demoTextContainer}>
              <Text style={[styles.demoTitle, { color: theme.secondaryForeground }]}>
                Try Demo Mode
              </Text>
              <Text style={[styles.demoDesc, { color: theme.secondaryForeground }]}>
                Explore the app with sample data — no sign up needed
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={theme.secondaryForeground} />
          </Pressable>

          <Pressable onPress={handleLearnMore} style={styles.learnMoreButton}>
            <Feather name="info" size={16} color={theme.primary} />
            <Text style={[styles.learnMoreLink, { color: theme.primary }]}>
              Learn more about Angelia
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  splashCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  actionsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 12,
  },
  actionButton: {
    width: '100%',
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
  demoTextContainer: {
    flex: 1,
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
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  learnMoreLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Learn More screen
  learnMoreContent: {
    padding: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 15,
    fontWeight: '500',
  },
  learnMoreTitle: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  learnMoreSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  archetypeCard: {
    padding: 20,
    marginBottom: 12,
    gap: 8,
  },
  archetypeEmoji: {
    fontSize: 32,
  },
  archetypeTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  archetypeQuestion: {
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  archetypeBenefit: {
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  aboutCard: {
    padding: 16,
    marginBottom: 12,
  },
  aboutCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  aboutCardContent: {
    fontSize: 13,
    lineHeight: 20,
  },
  learnMoreCta: {
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  learnMoreCtaText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
