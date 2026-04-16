import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { UserStatus } from '@/models/types';

interface NowStatusBadgeProps {
  status: UserStatus | null | undefined;
  style?: ViewStyle;
}

/**
 * Returns true when the status is active (now is between startAt and endAt).
 */
function isStatusActive(status: UserStatus | null | undefined): status is UserStatus {
  if (!status) return false;
  const now = Date.now();
  return now >= status.startAt && now < status.endAt;
}

/**
 * A soft, ambient pill that shows a user's current "Now" status.
 * Renders nothing when there is no active status.
 */
export function NowStatusBadge({ status, style }: NowStatusBadgeProps) {
  const { theme } = useTheme();

  if (!isStatusActive(status)) return null;

  return (
    <View style={[styles.pill, { backgroundColor: theme.secondary }, style]}>
      <Text style={styles.emoji}>{status.emoji}</Text>
      <Text
        style={[styles.text, { color: theme.secondaryForeground }]}
        numberOfLines={1}
      >
        {status.text}
      </Text>
    </View>
  );
}

export { isStatusActive };

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  emoji: {
    fontSize: 13,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
});
