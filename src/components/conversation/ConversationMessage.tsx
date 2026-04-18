import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { useAppSelector } from '@/store/hooks';
import { getRelativeTime } from '@/lib/timeUtils';
import { useTheme } from '@/hooks/useTheme';
import type { Message } from '@/models/types';

interface ConversationMessageProps {
  message: Message;
  isThreaded: boolean;
  onLongPress?: () => void;
  onSwipeRight?: () => void;
}

export function ConversationMessage({
  message,
  isThreaded,
  onLongPress,
}: ConversationMessageProps) {
  const author = useAppSelector((state) =>
    state.users.users.find((u) => u.id === message.authorId),
  );
  const { theme } = useTheme();

  if (message.isSystem) {
    return (
      <View style={styles.systemRow}>
        <Avatar preset={author?.avatar ?? 'moon'} size="sm" />
        <Text style={[styles.systemText, { color: theme.mutedForeground }]}>
          {author?.firstName ?? 'Someone'} {message.text}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onLongPress={onLongPress}
      style={[styles.container, isThreaded && styles.threaded]}
    >
      {/* Connector line for threaded replies */}
      {isThreaded && (
        <View
          style={[styles.connectorLine, { borderColor: theme.border }]}
        />
      )}

      {/* 36×36 Avatar anchor */}
      <Avatar
        preset={author?.avatar ?? 'moon'}
        size="sm"
        style={styles.avatar}
      />

      <View style={styles.body}>
        {/* Header: Name | Timestamp */}
        <View style={styles.headerLine}>
          <Text style={[styles.displayName, { color: theme.foreground }]}>
            {author?.firstName ?? 'Unknown'}
          </Text>
          <Text style={[styles.timestamp, { color: theme.mutedForeground }]}>
            {getRelativeTime(message.timestamp)}
          </Text>
        </View>

        {/* Message text */}
        <Text style={[styles.messageText, { color: theme.foreground }]}>
          {message.text}
        </Text>
      </View>
    </Pressable>
  );
}

const INDENT = 24;
const AVATAR_SIZE = 36;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  threaded: {
    paddingLeft: 16 + INDENT,
  },
  connectorLine: {
    position: 'absolute',
    left: 16 + AVATAR_SIZE / 2 - INDENT,
    top: 0,
    width: INDENT - 4,
    height: 24,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderBottomLeftRadius: 8,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  body: {
    flex: 1,
    marginLeft: 10,
  },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 2,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  systemText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
