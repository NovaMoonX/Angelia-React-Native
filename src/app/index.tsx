import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AngeliaLogo } from '@/components/AngeliaLogo';
import { ComparisonTable } from '@/components/ComparisonTable';
import { ThemeToggle } from '@/components/ThemeToggle';
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

const USE_CASES = [
  {
    emoji: '👴',
    title: 'Remote Elder',
    description:
      'Grandparents wanting daily connection without tech friction',
  },
  {
    emoji: '💼',
    title: 'Global Professional',
    description:
      'Busy individuals who need to catch up during downtime',
  },
  {
    emoji: '👨‍👩‍👧',
    title: 'Saturated Parent',
    description:
      'Parents who want to share without performance pressure',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();

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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <AngeliaLogo size={28} />
        <ThemeToggle />
      </View>

      {/* Hero Section */}
      <View style={styles.hero}>
        <AngeliaLogo size={64} />
        <Text style={[styles.heroTitle, { color: theme.foreground }]}>
          Angelia
        </Text>
        <Text style={[styles.heroSubtitle, { color: theme.mutedForeground }]}>
          Family updates without the noise. Curate, subscribe, connect.
        </Text>

        <View style={styles.ctaRow}>
          <Button onPress={handleGetStarted}>Get Started</Button>
          <Button variant="outline" onPress={handleTryDemo}>
            Try Demo
          </Button>
        </View>
      </View>

      <Separator style={{ marginVertical: 24 }} />

      {/* Comparison */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
          Why Angelia?
        </Text>
        <ComparisonTable />
      </View>

      <Separator style={{ marginVertical: 24 }} />

      {/* Use Cases */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
          Who It's For
        </Text>
        {USE_CASES.map((uc) => (
          <Card key={uc.title} style={styles.useCaseCard}>
            <Text style={styles.useCaseEmoji}>{uc.emoji}</Text>
            <Text
              style={[styles.useCaseTitle, { color: theme.foreground }]}
            >
              {uc.title}
            </Text>
            <Text
              style={[
                styles.useCaseDesc,
                { color: theme.mutedForeground },
              ]}
            >
              {uc.description}
            </Text>
          </Card>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable onPress={() => router.push('/about')}>
          <Text style={[styles.footerLink, { color: theme.primary }]}>
            About Angelia
          </Text>
        </Pressable>
        <Text style={[styles.footerText, { color: theme.mutedForeground }]}>
          © 2025 Angelia — Built with ❤️ for families
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingTop: 60,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  hero: {
    alignItems: 'center',
    gap: 12,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  useCaseCard: {
    alignItems: 'center',
    padding: 20,
  },
  useCaseEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  useCaseTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  useCaseDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
    paddingBottom: 40,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerText: {
    fontSize: 12,
  },
});
