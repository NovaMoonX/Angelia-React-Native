import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface ReactionDisplayProps {
  emoji: string;
  count: number;
  isUserReacted: boolean;
  onClick: () => void;
}

export function ReactionDisplay({
  emoji,
  count,
  isUserReacted,
  onClick,
}: ReactionDisplayProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onClick}
      style={[
        styles.container,
        {
          borderColor: isUserReacted ? theme.primary : theme.border,
          backgroundColor: isUserReacted
            ? `${theme.primary}20`
            : theme.card,
        },
      ]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text
        style={[
          styles.count,
          {
            color: isUserReacted ? theme.primary : theme.foreground,
            fontWeight: isUserReacted ? '700' : '500',
          },
        ]}
      >
        {count}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  emoji: {
    fontSize: 16,
  },
  count: {
    fontSize: 12,
  },
});
