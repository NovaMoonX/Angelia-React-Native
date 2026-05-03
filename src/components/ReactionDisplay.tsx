import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface ReactionDisplayProps {
  emojis: string[];
  displayName: string;
  isCurrentUser: boolean;
  onClick: () => void;
}

export function ReactionDisplay({
  emojis,
  displayName,
  isCurrentUser,
  onClick,
}: ReactionDisplayProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={isCurrentUser ? onClick : undefined}
      style={[
        styles.container,
        {
          borderColor: isCurrentUser ? theme.primary : theme.border,
          backgroundColor: isCurrentUser
            ? `${theme.primary}20`
            : theme.card,
        },
      ]}
    >
      <Text style={styles.emoji}>{emojis.join('')}</Text>
      <Text
        style={[
          styles.name,
          {
            color: isCurrentUser ? theme.primary : theme.foreground,
            fontWeight: isCurrentUser ? '700' : '500',
          },
        ]}
      >
        {displayName}
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
  name: {
    fontSize: 12,
  },
});
