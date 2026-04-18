import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export function ConversationEmptyState() {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🌙</Text>
      <Text style={[styles.text, { color: theme.mutedForeground }]}>
        The room is quiet… say something sweet to start the chat.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
