import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { NowStatusBadge, isStatusActive } from '@/components/NowStatusBadge';
import { useTheme } from '@/hooks/useTheme';
import { getRelativeTime } from '@/lib/timeUtils';
import type { User } from '@/models/types';

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: User | null | undefined;
}

/**
 * Formats milliseconds remaining into a human-friendly string like "3h left" or "25m left".
 */
function formatTimeRemaining(expiresAt: number): string {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return 'Expired';

  const minutes = Math.floor(remaining / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m left`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;

  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

export function UserProfileModal({ visible, onClose, user }: UserProfileModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!user) return null;

  const hasActiveStatus = isStatusActive(user.status);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              paddingBottom: insets.bottom + 16,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Handle bar */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar + Name */}
            <View style={styles.profileHeader}>
              <Avatar preset={user.avatar} size="xl" />
              <Text style={[styles.name, { color: theme.foreground }]}>
                {user.firstName} {user.lastName}
              </Text>
              {user.funFact ? (
                <Text style={[styles.funFact, { color: theme.mutedForeground }]}>
                  💡 {user.funFact}
                </Text>
              ) : null}
            </View>

            {/* Status — prominent section */}
            {hasActiveStatus && (
              <View
                style={[styles.statusCard, { backgroundColor: theme.secondary }]}
              >
                <Text style={styles.statusEmoji}>{user.status?.emoji}</Text>
                <View style={styles.statusContent}>
                  <Text
                    style={[styles.statusText, { color: theme.secondaryForeground }]}
                  >
                    {user.status?.text}
                  </Text>
                  <Text
                    style={[styles.statusExpiry, { color: theme.mutedForeground }]}
                  >
                    {formatTimeRemaining(user.status?.expiresAt ?? 0)}
                  </Text>
                </View>
              </View>
            )}

            {!hasActiveStatus && (
              <View style={[styles.noStatus, { borderColor: theme.border }]}>
                <Text style={[styles.noStatusText, { color: theme.mutedForeground }]}>
                  No status set
                </Text>
              </View>
            )}

            {/* Meta info */}
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.mutedForeground }]}>
                Joined
              </Text>
              <Text style={[styles.metaValue, { color: theme.foreground }]}>
                {getRelativeTime(user.joinedAt)}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  body: {
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  profileHeader: {
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  funFact: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  statusEmoji: {
    fontSize: 28,
    marginTop: 2,
  },
  statusContent: {
    flex: 1,
    gap: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  statusExpiry: {
    fontSize: 12,
  },
  noStatus: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
  },
  noStatusText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  metaLabel: {
    fontSize: 13,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '500',
  },
});
