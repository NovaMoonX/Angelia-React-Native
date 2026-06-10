import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AddReactionIcon } from '@/components/AddReactionIcon';
import { ReactionDisplay } from '@/components/ReactionDisplay';
import { useAppSelector } from '@/store/hooks';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { useTheme } from '@/hooks/useTheme';
import { getMessageReactionDisplayGroups } from '@/lib/message/messageReaction.utils';

interface MessageReactionRowProps {
  reactions: Record<string, string[]>;
  currentUserId: string | null;
  onToggleReaction: (emoji: string) => void;
  onOpenReactionPicker: () => void;
}

export function MessageReactionRow({
  reactions,
  currentUserId,
  onToggleReaction,
  onOpenReactionPicker,
}: MessageReactionRowProps) {
  const { theme } = useTheme();
  const usersMap = useAppSelector(selectAllUsersMapById);
  const groups = getMessageReactionDisplayGroups(reactions, usersMap, currentUserId);

  if (groups.length === 0) {
    return (
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenReactionPicker();
        }}
        style={[styles.addOnlyButton, { borderColor: theme.border }]}
        hitSlop={8}
      >
        <AddReactionIcon size={16} color={theme.mutedForeground} />
      </Pressable>
    );
  }

  return (
    <View style={styles.row}>
      {groups.map((group) => (
        <ReactionDisplay
          key={group.emoji}
          emoji={group.emoji}
          count={group.count}
          names={group.names}
          currentUserReacted={group.currentUserReacted}
          onClick={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggleReaction(group.emoji);
          }}
        />
      ))}
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenReactionPicker();
        }}
        style={[styles.addButton, { borderColor: theme.border }]}
      >
        <AddReactionIcon size={16} color={theme.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOnlyButton: {
    alignSelf: 'flex-start',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
});
