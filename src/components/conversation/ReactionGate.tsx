import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

/**
 * Blurred overlay shown when the user hasn't reacted to the post yet.
 * Uses a semi-transparent backdrop since expo-blur is not in the dependency tree.
 */
export function ReactionGate() {
  const { theme } = useTheme();

  return (
    <View style={[styles.overlay, { backgroundColor: theme.background + 'E6' }]}>
      <Text style={styles.icon}>💬</Text>
      <Text style={[styles.title, { color: theme.foreground }]}>
        React to join the conversation
      </Text>
      <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
        React to this post to join the conversation.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 10,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
