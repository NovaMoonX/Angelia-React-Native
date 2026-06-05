import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { useAppSelector } from '@/store/hooks';
import { getRelativeTime } from '@/lib/timeUtils';
import { useTheme } from '@/hooks/useTheme';
import { useUserIdentity } from '@/hooks/useUserIdentity';
import type { Message } from '@/models/types';

interface ConversationMessageProps {
  message: Message;
  isThreaded: boolean;
  hasReplies?: boolean;
  continuationDepths?: number[];
  depth?: number;
  parentText?: string | null;
  onSinglePress?: () => void;
  onLongPress?: () => void;
  onDoublePress?: () => void;
  onSwipeRight?: () => void;
}

export function ConversationMessage({
  message,
  isThreaded,
  hasReplies = false,
  continuationDepths = [],
  depth = 0,
  parentText,
  onSinglePress,
  onLongPress,
  onDoublePress,
}: ConversationMessageProps) {
  const author = useAppSelector((state) =>
    state.users.users.find((u) => u.id === message.authorId),
  );
  const authorIdentity = useUserIdentity(message.authorId, author);
  const { theme } = useTheme();
  const lastPressAtRef = useRef(0);
  const singlePressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (singlePressTimeoutRef.current) {
        clearTimeout(singlePressTimeoutRef.current);
        singlePressTimeoutRef.current = null;
      }
    };
  }, []);

  if (message.isSystem) {
    return (
      <View style={styles.systemRow}>
        <Avatar preset={authorIdentity.avatarPreset} uri={authorIdentity.avatarUrl} size="sm" />
        <Text style={[styles.systemText, { color: theme.mutedForeground }]}>
          {authorIdentity.displayName} {message.text}
        </Text>
      </View>
    );
  }

  const clampedDepth = Math.min(Math.max(depth, 0), 2);
  const parentDepth = Math.max(clampedDepth - 1, 0);
  const rowPaddingLeft = BASE_LEFT_PADDING + clampedDepth * INDENT;
  const avatarCenterX = BASE_LEFT_PADDING + clampedDepth * INDENT + AVATAR_SIZE / 2;
  const parentAvatarCenterX = BASE_LEFT_PADDING + parentDepth * INDENT + AVATAR_SIZE / 2;

  return (
    <Pressable
      onLongPress={onLongPress}
      onPress={() => {
        if (!onSinglePress && !onDoublePress) return;
        const now = Date.now();
        if (now - lastPressAtRef.current < 280) {
          if (singlePressTimeoutRef.current) {
            clearTimeout(singlePressTimeoutRef.current);
            singlePressTimeoutRef.current = null;
          }
          onDoublePress?.();
          lastPressAtRef.current = 0;
          return;
        }
        lastPressAtRef.current = now;
        if (singlePressTimeoutRef.current) {
          clearTimeout(singlePressTimeoutRef.current);
        }
        singlePressTimeoutRef.current = setTimeout(() => {
          singlePressTimeoutRef.current = null;
          onSinglePress?.();
        }, 320);
      }}
      style={[styles.container, { paddingLeft: rowPaddingLeft }]}
    >
      {/* Vertical stem from this message down toward its replies */}
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

      {/* Connector line for threaded replies */}
      {isThreaded && (
        <>
          <View
            style={[
              styles.connectorElbow,
              {
                borderColor: theme.border,
                left: parentAvatarCenterX,
              },
            ]}
          />
        </>
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

      {/* 36×36 Avatar anchor */}
      <Avatar
        preset={authorIdentity.avatarPreset}
        uri={authorIdentity.avatarUrl}
        size="sm"
        style={styles.avatar}
      />

      <View style={styles.body}>
        {/* Header: Name | Timestamp */}
        <View style={styles.headerLine}>
          <Text style={[styles.displayName, { color: theme.foreground }]}>
            {authorIdentity.displayName}
          </Text>
          <Text style={[styles.timestamp, { color: theme.mutedForeground }]}>
            {getRelativeTime(message.timestamp)}
          </Text>
        </View>

        {/* Parent message quote (for replies) */}
        {isThreaded && parentText != null && (
          <Text style={[styles.parentQuote, { color: theme.mutedForeground, borderLeftColor: theme.border }]} numberOfLines={2}>
            {parentText.length > 80 ? parentText.slice(0, 80) + '…' : parentText}
          </Text>
        )}

        {/* Message text */}
        <Text style={[styles.messageText, { color: theme.foreground }]}>
          {message.text}
        </Text>
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
