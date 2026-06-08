import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/hooks/useTheme';
import { getRelativeTime } from '@/lib/timeUtils';
import type { PrivateNote, User } from '@/models/types';

interface PrivateNoteListCardProps {
  note: PrivateNote;
  author: User | null | undefined;
  authorLabel: string;
  hasUnreadReply?: boolean;
  onPress: () => void;
}

export function PrivateNoteListCard({
  note,
  author,
  authorLabel,
  hasUnreadReply = false,
  onPress,
}: PrivateNoteListCardProps) {
  const { theme } = useTheme();
  const unreadHighlightColor = '#D4A017';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.noteCard,
        {
          backgroundColor: theme.card,
          borderColor: hasUnreadReply ? unreadHighlightColor : theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Avatar user={author} size="sm" showStatus={false} />
      <View style={styles.noteContent}>
        <View style={styles.noteHeader}>
          <Text style={[styles.authorName, { color: theme.foreground }]}>{authorLabel}</Text>
          <Text style={[styles.timestamp, { color: theme.mutedForeground }]}>
            {getRelativeTime(note.timestamp)}
          </Text>
        </View>
        <Text style={[styles.noteText, { color: theme.foreground }]} numberOfLines={3}>
          {note.text}
        </Text>
        {hasUnreadReply ? (
          <Text style={[styles.unreadReplyLabel, { color: unreadHighlightColor }]}>New reply</Text>
        ) : null}
      </View>
      <Feather
        name="chevron-right"
        size={18}
        color={hasUnreadReply ? unreadHighlightColor : theme.mutedForeground}
        style={styles.chevron}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  noteContent: {
    flex: 1,
    gap: 4,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  unreadReplyLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: 2,
  },
});
