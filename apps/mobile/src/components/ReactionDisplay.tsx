import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

function formatNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

interface ReactionDisplayProps {
  emoji: string;
  count: number;
  names: string[];
  currentUserReacted: boolean;
  onClick: () => void;
}

export function ReactionDisplay({
  emoji,
  count,
  names,
  currentUserReacted,
  onClick,
}: ReactionDisplayProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={currentUserReacted ? onClick : undefined}
      style={[
        styles.container,
        {
          borderColor: currentUserReacted ? theme.primary : theme.border,
          backgroundColor: currentUserReacted
            ? `${theme.primary}20`
            : theme.card,
        },
      ]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text
        style={[
          styles.label,
          {
            color: currentUserReacted ? theme.primary : theme.foreground,
            fontWeight: currentUserReacted ? '700' : '500',
          },
        ]}
      >
        {formatNames(names)}
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
  label: {
    fontSize: 12,
  },
});
