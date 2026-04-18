import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export function ConversationEmptyState() {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.illustration}>
        <Text style={styles.bubbleLeft}>💬</Text>
        <Text style={styles.star}>✨</Text>
        <Text style={styles.bubbleRight}>🌙</Text>
      </View>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        No messages yet!
      </Text>
      <Text style={[styles.body, { color: theme.mutedForeground }]}>
        Be the first to say something — every great conversation starts with one message. ✨
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 64,
    gap: 12,
  },
  illustration: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginBottom: 8,
  },
  bubbleLeft: {
    fontSize: 52,
  },
  star: {
    fontSize: 28,
    marginBottom: 12,
  },
  bubbleRight: {
    fontSize: 40,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
