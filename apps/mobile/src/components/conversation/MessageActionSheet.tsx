import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Modal } from '@/components/ui/Modal';
import { ReactionPill } from '@/components/ReactionPill';
import { useTheme } from '@/hooks/useTheme';
import { getSuggestedMessageReactionEmojis } from '@/lib/message/messageReaction.utils';
import type { Message } from '@/models/types';

export type MessageActionId = 'reply' | 'react' | 'edit' | 'delete';

export interface MessageActionOption {
  id: MessageActionId;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  destructive?: boolean;
}

interface MessageActionSheetProps {
  visible: boolean;
  message: Message | null;
  currentUserId: string | null;
  options: MessageActionOption[];
  onClose: () => void;
  onSelectAction: (actionId: MessageActionId) => void;
  onSelectReaction: (emoji: string) => void;
  onOpenReactionPicker: () => void;
}

export function MessageActionSheet({
  visible,
  message,
  currentUserId,
  options,
  onClose,
  onSelectAction,
  onSelectReaction,
  onOpenReactionPicker,
}: MessageActionSheetProps) {
  const { theme } = useTheme();

  if (!message) {
    return null;
  }

  const suggestedEmojis = getSuggestedMessageReactionEmojis({
    reactions: message.reactions ?? {},
    currentUserId,
    max: 6,
  });

  return (
    <Modal isOpen={visible} onClose={onClose} title="Message options">
      <View style={styles.content}>
        <ReactionPill
          emojis={suggestedEmojis}
          onSelect={(emoji) => {
            onSelectReaction(emoji);
            onClose();
          }}
          onOpenPicker={() => {
            onOpenReactionPicker();
            onClose();
          }}
          size="compact"
          style={styles.reactionPill}
        />

        {options.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => {
              onSelectAction(option.id);
              onClose();
            }}
            style={({ pressed }) => [
              styles.actionRow,
              {
                backgroundColor: pressed ? theme.muted : 'transparent',
                borderColor: theme.border,
              },
            ]}
          >
            <Feather
              name={option.icon}
              size={18}
              color={option.destructive ? theme.destructive : theme.foreground}
            />
            <Text
              style={[
                styles.actionLabel,
                { color: option.destructive ? theme.destructive : theme.foreground },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  reactionPill: {
    alignSelf: 'stretch',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});
