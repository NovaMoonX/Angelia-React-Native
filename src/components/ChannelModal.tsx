import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Separator } from '@/components/ui/Separator';
import { HelpIcon } from '@/components/ui/HelpIcon';
import {
  getColorPair,
  generateChannelInviteLink,
} from '@/lib/channel/channel.utils';
import type { Channel, User } from '@/models/types';
import { useTheme } from '@/hooks/useTheme';

interface ChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  subscribers?: User[];
  onRefreshInviteCode?: () => void;
  onRemoveSubscriber?: (subscriberId: string) => void;
  removingSubscriberId?: string | null;
}

export function ChannelModal({
  isOpen,
  onClose,
  channel,
  subscribers = [],
  onRefreshInviteCode,
  onRemoveSubscriber,
  removingSubscriberId,
}: ChannelModalProps) {
  const { theme } = useTheme();
  const colors = getColorPair(channel);
  const inviteUrl = generateChannelInviteLink(channel);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={channel.name}>
      <View style={styles.container}>
        <Badge
          style={{
            backgroundColor: colors.backgroundColor,
            borderColor: colors.backgroundColor,
          }}
          textStyle={{
            color: colors.textColor,
            fontSize: 14,
            fontWeight: '600',
          }}
        >
          {channel.name}
        </Badge>

        {channel.description ? (
          <Text style={[styles.description, { color: theme.mutedForeground }]}>
            {channel.description}
          </Text>
        ) : null}

        <Separator />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
              Invite Link
            </Text>
            {onRefreshInviteCode && (
              <View style={styles.refreshRow}>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={onRefreshInviteCode}
                >
                  Refresh
                </Button>
                <HelpIcon message="Generates a brand-new invite link and instantly invalidates the old one." />
              </View>
            )}
          </View>
          {inviteUrl ? (
            <CopyButton
              textToCopy={inviteUrl}
              variant="secondary"
              disabled={!inviteUrl}
            >
              Copy Invite Link
            </CopyButton>
          ) : (
            <Text
              style={[styles.noInvite, { color: theme.mutedForeground }]}
            >
              No invite link available
            </Text>
          )}

          {channel.inviteCode && (
            <View style={styles.qrSection}>
              <View style={styles.qrContainer}>
                <QRCode
                  value={inviteUrl || channel.inviteCode}
                  size={160}
                  backgroundColor="#FFFFFF"
                  color="#111827"
                />
              </View>
              <View style={styles.inviteCodeRow}>
                <Text style={[styles.inviteCodeLabel, { color: theme.mutedForeground }]}>
                  Invite code:
                </Text>
                <Text style={[styles.inviteCodeValue, { color: theme.foreground }]}>
                  {channel.inviteCode}
                </Text>
              </View>
              <CopyButton
                textToCopy={channel.inviteCode}
                variant="outline"
                size="sm"
              >
                Copy Code
              </CopyButton>
            </View>
          )}
        </View>

        <Separator />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
            Members ({subscribers.length})
          </Text>
          {subscribers.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
              No members yet
            </Text>
          ) : (
            subscribers.map((sub) => (
              <View key={sub.id} style={styles.subscriberRow}>
                <Avatar user={sub} size="sm" />
                <Text
                  style={[styles.subscriberName, { color: theme.foreground }]}
                >
                  {sub.firstName} {sub.lastName}
                </Text>
                {onRemoveSubscriber && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onPress={() => onRemoveSubscriber(sub.id)}
                    loading={removingSubscriberId === sub.id}
                  >
                    Remove
                  </Button>
                )}
              </View>
            ))
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noInvite: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  qrSection: {
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  qrContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  inviteCodeLabel: {
    fontSize: 13,
  },
  inviteCodeValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  subscriberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  subscriberName: {
    flex: 1,
    fontSize: 14,
  },
});
