import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { MessageReactionRow } from '@/components/conversation/MessageReactionRow';
import { useAppSelector } from '@/store/hooks';
import { getRelativeTime } from '@/lib/timeUtils';
import { useTheme } from '@/hooks/useTheme';
import { isPersistedMessage } from '@/lib/message/messageReaction.utils';
import type { Message } from '@/models/types';

interface ConversationMessageProps {
  message: Message;
  isThreaded: boolean;
  hasReplies?: boolean;
  continuationDepths?: number[];
  depth?: number;
  parentText?: string | null;
  currentUserId?: string | null;
  showReactions?: boolean;
  onSinglePress?: () => void;
  onOpenActions?: () => void;
  onAvatarPress?: () => void;
  onToggleReaction?: (emoji: string) => void;
  onOpenReactionPicker?: () => void;
}

export function ConversationMessage({
  message,
  isThreaded,
  hasReplies = false,
  continuationDepths = [],
  depth = 0,
  parentText,
  currentUserId = null,
  showReactions = true,
  onSinglePress,
  onOpenActions,
  onAvatarPress,
  onToggleReaction,
  onOpenReactionPicker,
}: ConversationMessageProps) {
  const author = useAppSelector((state) =>
    state.users.users.find((u) => u.id === message.authorId),
  );
  const { theme } = useTheme();
  const singlePressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (singlePressTimeoutRef.current) {
        clearTimeout(singlePressTimeoutRef.current);
        singlePressTimeoutRef.current = null;
      }
    };
  }, []);

  const canOpenAuthorProfile =
    Boolean(author && currentUserId && author.id !== currentUserId && onAvatarPress);

  const avatarNode = (
    <Avatar user={author} size="sm" style={styles.avatar} />
  );

  if (message.isSystem) {
    return (
      <View style={styles.systemRow}>
        {canOpenAuthorProfile ? (
          <Pressable onPress={onAvatarPress}>{avatarNode}</Pressable>
        ) : (
          avatarNode
        )}
        <Text style={[styles.systemText, { color: theme.mutedForeground }]}>
          {author?.firstName ?? 'Someone'} {message.text}
        </Text>
      </View>
    );
  }

  const clampedDepth = Math.min(Math.max(depth, 0), 2);
  const parentDepth = Math.max(clampedDepth - 1, 0);
  const rowPaddingLeft = BASE_LEFT_PADDING + clampedDepth * INDENT;
  const avatarCenterX = BASE_LEFT_PADDING + clampedDepth * INDENT + AVATAR_SIZE / 2;
  const parentAvatarCenterX = BASE_LEFT_PADDING + parentDepth * INDENT + AVATAR_SIZE / 2;
  const canInteract = Boolean(onOpenActions) && isPersistedMessage(message);
  const canShowReactions =
    showReactions &&
    isPersistedMessage(message) &&
    Boolean(onToggleReaction && onOpenReactionPicker);

  return (
    <Pressable
      onLongPress={onOpenActions}
      onPress={() => {
        if (!onSinglePress) {
          return;
        }
        if (singlePressTimeoutRef.current) {
          clearTimeout(singlePressTimeoutRef.current);
        }
        singlePressTimeoutRef.current = setTimeout(() => {
          singlePressTimeoutRef.current = null;
          onSinglePress();
        }, 0);
      }}
      style={[styles.container, { paddingLeft: rowPaddingLeft }]}
    >
      {hasReplies && (
        <View
          style={[
            styles.connectorStem,
            {
              borderColor: theme.border,
              left: avatarCenterX,
            },
          ]}
        />
      )}

      {isThreaded && (
        <View
          style={[
            styles.connectorElbow,
            {
              borderColor: theme.border,
              left: parentAvatarCenterX,
            },
          ]}
        />
      )}

      {continuationDepths.map((continuationDepth) => {
        const continuationX = BASE_LEFT_PADDING + continuationDepth * INDENT + AVATAR_SIZE / 2;
        return (
          <View
            key={`continuation-${message.id}-${continuationDepth}`}
            style={[
              styles.parentThreadSpineContinuation,
              {
                borderColor: theme.border,
                left: continuationX,
              },
            ]}
          />
        );
      })}

      {canOpenAuthorProfile ? (
        <Pressable onPress={onAvatarPress}>{avatarNode}</Pressable>
      ) : (
        avatarNode
      )}

      <View style={styles.body}>
        <View style={styles.headerLine}>
          <Text style={[styles.displayName, { color: theme.foreground }]}>
            {author?.firstName ?? 'Unknown'}
          </Text>
          <Text style={[styles.timestamp, { color: theme.mutedForeground }]}>
            {getRelativeTime(message.timestamp)}
          </Text>
          {canInteract ? (
            <Pressable
              onPress={onOpenActions}
              hitSlop={10}
              style={styles.actionsButton}
            >
              <Feather name="more-horizontal" size={16} color={theme.mutedForeground} />
            </Pressable>
          ) : null}
        </View>

        {isThreaded && parentText != null && (
          <Text
            style={[
              styles.parentQuote,
              { color: theme.mutedForeground, borderLeftColor: theme.border },
            ]}
            numberOfLines={2}
          >
            {parentText.length > 80 ? `${parentText.slice(0, 80)}…` : parentText}
          </Text>
        )}

        <Text style={[styles.messageText, { color: theme.foreground }]}>
          {message.text}
        </Text>

        {canShowReactions ? (
          <MessageReactionRow
            reactions={message.reactions ?? {}}
            currentUserId={currentUserId}
            onToggleReaction={onToggleReaction!}
            onOpenReactionPicker={onOpenReactionPicker!}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const INDENT = 24;
const BASE_LEFT_PADDING = 16;
const AVATAR_SIZE = 36;
const CONNECTOR_OVERLAP = 1;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingRight: 16,
    paddingLeft: BASE_LEFT_PADDING,
  },
  connectorElbow: {
    position: 'absolute',
    top: 0,
    width: INDENT,
    height: AVATAR_SIZE / 2,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderBottomLeftRadius: 8,
  },
  parentThreadSpineContinuation: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderLeftWidth: 1.5,
  },
  connectorStem: {
    position: 'absolute',
    top: AVATAR_SIZE / 2 - CONNECTOR_OVERLAP,
    bottom: 0,
    borderLeftWidth: 1.5,
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
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    flex: 1,
  },
  actionsButton: {
    padding: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  parentQuote: {
    fontSize: 13,
    lineHeight: 18,
    borderLeftWidth: 2,
    paddingLeft: 8,
    marginBottom: 4,
    opacity: 0.7,
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
    opacity: 0.8,
  },
});
