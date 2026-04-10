import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { useAppSelector } from '@/store/hooks';
import { getRelativeTime } from '@/lib/timeUtils';
import { useTheme } from '@/hooks/useTheme';

interface ChatMessageProps {
  authorId: string;
  text: string;
  timestamp: number;
  isCurrentUser?: boolean;
}

export function ChatMessage({
  authorId,
  text,
  timestamp,
  isCurrentUser = false,
}: ChatMessageProps) {
  const author = useAppSelector((state) =>
    state.users.users.find((u) => u.id === authorId)
  );
  const { theme } = useTheme();

  return (
    <View style={[styles.container, isCurrentUser && styles.currentUser]}>
      {!isCurrentUser && (
        <Avatar preset={author?.avatar || 'moon'} size="sm" />
      )}
      <View
        style={[
          styles.bubble,
          isCurrentUser
            ? { backgroundColor: theme.primary }
            : {
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.border,
              },
        ]}
      >
        {!isCurrentUser && author && (
          <Text
            style={[styles.authorName, { color: theme.mutedForeground }]}
          >
            {author.firstName}
          </Text>
        )}
        <Text
          style={[
            styles.text,
            {
              color: isCurrentUser
                ? theme.primaryForeground
                : theme.foreground,
            },
          ]}
        >
          {text}
        </Text>
        <Text
          style={[
            styles.time,
            {
              color: isCurrentUser
                ? theme.primaryForeground
                : theme.mutedForeground,
            },
          ]}
        >
          {getRelativeTime(timestamp)}
        </Text>
      </View>
      {isCurrentUser && (
        <Avatar preset={author?.avatar || 'moon'} size="sm" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  currentUser: {
    flexDirection: 'row-reverse',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 12,
    padding: 10,
  },
  authorName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  time: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
});
