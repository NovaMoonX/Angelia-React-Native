import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
import { useTheme } from '@/hooks/useTheme';

const SECTIONS = [
  {
    title: 'The Connectivity Paradox',
    content:
      'We have more ways to communicate than ever before, yet meaningful connection keeps slipping through the noise. Group chats overflow, notifications pile up, and our most important relationships get lost in the digital storm.',
  },
  {
    title: 'The Crisis of Synchronous Noise',
    content:
      "Modern messaging apps assume everyone is available all the time. This 'always-on' expectation creates anxiety and guilt. Conversations get buried. Context gets lost. People stop sharing because it feels like shouting into a void.",
  },
  {
    title: 'The Solution: Categorical Agency',
    content:
      "Angelia reimagines family communication through channels, not chat rooms. Share your updates on your terms. Subscribe to what matters. No pressure to respond immediately — or at all. It's asynchronous connection designed for real life.",
  },
  {
    title: 'The 180-Day Rule',
    content:
      'Every post in Angelia expires after 6 months. This mandatory ephemerality reduces archive anxiety and encourages authentic, in-the-moment sharing. Life moves forward — your communication should too.',
  },
];

export default function AboutScreen() {
  const { theme } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.foreground }]}>
        The Angelia Manifesto
      </Text>
      <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
        Rebuilding meaningful family connections in a noisy digital world.
      </Text>

      <Separator style={{ marginVertical: 24 }} />

      {SECTIONS.map((section) => (
        <Card key={section.title} style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
            {section.title}
          </Text>
          <Text
            style={[styles.sectionContent, { color: theme.mutedForeground }]}
          >
            {section.content}
          </Text>
        </Card>
      ))}

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.mutedForeground }]}>
          Angelia — named after the Greek spirit of messages.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionCard: {
    marginBottom: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
