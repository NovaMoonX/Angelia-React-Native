import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { POST_TIERS } from '@/models/constants';
import type { PostTier, UserStatus } from '@/models/types';

interface Props {
  visible: boolean;
  circleName: string;
  seconds: number;
  tier: PostTier;
  mediaCount: number;
  pendingStatus: UserStatus | null;
  onCancel: () => void;
  onPostNow: () => void;
}

export function PostCountdownOverlay({
  visible,
  circleName,
  seconds,
  tier,
  mediaCount,
  pendingStatus,
  onCancel,
  onPostNow,
}: Props) {
  const { theme } = useTheme();

  if (!visible) return null;

  const tierInfo = POST_TIERS.find((t) => { return t.value === tier; }) ?? POST_TIERS[0];
  const hasStatus = pendingStatus !== null;

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        {/* Header */}
        <Text style={[styles.header, { color: theme.mutedForeground }]}>About to post</Text>

        {/* Circle name */}
        <Text style={[styles.circleName, { color: theme.foreground }]} numberOfLines={2}>
          {circleName}
        </Text>

        {/* Countdown */}
        <View style={styles.timerBlock}>
          <Text style={[styles.countdown, { color: theme.primary }]}>{seconds}</Text>
          <Text style={[styles.timerLabel, { color: theme.mutedForeground }]}>
            Posting in {seconds}s…
          </Text>
        </View>

        {/* Detail badges */}
        <View style={[styles.badgeRow, { borderTopColor: theme.border }]}>
          {/* Tier */}
          <View style={[styles.badge, { backgroundColor: `${theme.primary}14` }]}>
            <Text style={styles.badgeEmoji}>{tierInfo.emoji}</Text>
            <Text style={[styles.badgeText, { color: theme.foreground }]}>{tierInfo.label}</Text>
          </View>

          {/* Media count */}
          {mediaCount > 0 && (
            <View style={[styles.badge, { backgroundColor: `${theme.primary}14` }]}>
              <Feather name="image" size={13} color={theme.primary} />
              <Text style={[styles.badgeText, { color: theme.foreground }]}>
                {mediaCount} {mediaCount === 1 ? 'attachment' : 'attachments'}
              </Text>
            </View>
          )}

          {/* Status */}
          {hasStatus && pendingStatus && (
            <View style={[styles.badge, { backgroundColor: `${theme.primary}14` }]}>
              <Text style={styles.badgeEmoji}>{pendingStatus.emoji}</Text>
              <Text style={[styles.badgeText, { color: theme.foreground }]} numberOfLines={1}>
                {pendingStatus.text}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            style={[styles.btn, { borderColor: theme.border }]}
          >
            <Text style={[styles.btnText, { color: theme.foreground }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={onPostNow}
            style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.primary }]}
          >
            <Text style={[styles.btnText, { color: theme.primaryForeground }]}>Post Now</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    width: '82%',
    maxWidth: 320,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
    gap: 12,
  },
  header: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  circleName: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  timerBlock: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  countdown: {
    fontSize: 60,
    fontWeight: '800',
    lineHeight: 64,
  },
  timerLabel: {
    fontSize: 13,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeEmoji: {
    fontSize: 13,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 110,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    paddingTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  btnPrimary: {
    borderWidth: 0,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
