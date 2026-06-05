import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { useConnectionDisplayName } from '@/hooks/useConnectionDisplayName';

function MemberDisplayName({ user }: { user: User }) {
  const displayName = useConnectionDisplayName(user.id);
  const { theme } = useTheme();
  return (
    <Text style={[styles.subscriberName, { color: theme.foreground }]}>
      {displayName}
    </Text>
  );
}

interface ChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  subscribers?: User[];
  onRefreshInviteCode?: () => void;
  onRemoveSubscriber?: (subscriberId: string) => void;
  removingSubscriberId?: string | null;
  /** Label for the per-subscriber action button. Defaults to "Remove". */
  removeSubscriberLabel?: string;
  inviteCandidates?: User[];
  pendingInviteeIds?: string[];
  onInviteCandidate?: (userId: string) => void;
  invitingCandidateId?: string | null;
  /** Whether the current user owns this channel. Used to gate private-circle invite visibility. */
  isOwner?: boolean;
}

export function ChannelModal({
  isOpen,
  onClose,
  channel,
  subscribers = [],
  onRefreshInviteCode,
  onRemoveSubscriber,
  removingSubscriberId,
  removeSubscriberLabel = 'Remove',
  inviteCandidates = [],
  pendingInviteeIds = [],
  onInviteCandidate,
  invitingCandidateId,
  isOwner = false,
}: ChannelModalProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = getColorPair(channel);
  const inviteUrl = generateChannelInviteLink(channel);
  const [inviteLinkSectionOpen, setInviteLinkSectionOpen] = useState(false);
  const [inviteFromPeopleSectionOpen, setInviteFromPeopleSectionOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setInviteLinkSectionOpen(false);
    setInviteFromPeopleSectionOpen(false);
  }, [isOpen]);

  const pendingInviteeIdSet = useMemo(() => {
    return new Set(pendingInviteeIds);
  }, [pendingInviteeIds]);

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

        {channel.isDaily ? (
          <View style={[styles.dailyInfoBox, { backgroundColor: theme.secondary }]}>
            <Text style={[styles.dailyInfoTitle, { color: theme.secondaryForeground }]}>
              Daily Circle invites happen through connections
            </Text>
            <Text style={[styles.dailyInfoText, { color: theme.secondaryForeground }]}>
              Looking to add people? Connect with them from your feed and they’ll appear in your Daily Circle.
            </Text>
            <View style={styles.dailyActionRow}>
              <Button
                variant="outline"
                size="sm"
                onPress={() => router.push('/(protected)/share-connection')}
                style={styles.dailyActionButton}
              >
                Share connection link
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => router.push('/scan-qr')}
                style={styles.dailyActionButton}
              >
                Scan QR code
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            {channel.isPrivate && !isOwner ? (
              <View style={[styles.privateNotice, { backgroundColor: theme.secondary }]}>
                <Text style={[styles.privateNoticeText, { color: theme.secondaryForeground }]}>
                  🔒 This is a private circle. Only the host can invite new members.
                </Text>
              </View>
            ) : (
              <>
                <Pressable
                  onPress={() => setInviteLinkSectionOpen((prev) => !prev)}
                  style={styles.collapsibleHeader}
                >
                  <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Invite Link</Text>
                  <Feather
                    name={inviteLinkSectionOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.mutedForeground}
                  />
                </Pressable>
                {inviteLinkSectionOpen && (
                  <>
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
                  </>
                )}
              </>
            )}
          </View>
        )}

        <Separator />

        {onInviteCandidate && !channel.isDaily && (
          <>
            <View style={styles.section}>
              <Pressable
                onPress={() => setInviteFromPeopleSectionOpen((prev) => !prev)}
                style={styles.collapsibleHeader}
              >
                <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Invite from My People</Text>
                <Feather
                  name={inviteFromPeopleSectionOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.mutedForeground}
                />
              </Pressable>
              {inviteFromPeopleSectionOpen && (
                <>
                  {inviteCandidates.length === 0 ? (
                    <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>All your connected people are already in this Circle.</Text>
                  ) : (
                    inviteCandidates.map((person) => {
                      const isInvited = pendingInviteeIdSet.has(person.id);
                      return (
                        <View key={person.id} style={styles.subscriberRow}>
                          <Avatar user={person} size="sm" showStatus={false} />
                          <MemberDisplayName user={person} />
                          <Button
                            variant={isInvited ? 'secondary' : 'outline'}
                            size="sm"
                            onPress={() => onInviteCandidate(person.id)}
                            loading={invitingCandidateId === person.id}
                            disabled={isInvited}
                          >
                            {isInvited ? 'Invited' : 'Invite'}
                          </Button>
                        </View>
                      );
                    })
                  )}
                </>
              )}
            </View>

            <Separator />
          </>
        )}

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
                <Avatar user={sub} size="sm" showStatus={false} />
                <MemberDisplayName user={sub} />
                {onRemoveSubscriber && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onPress={() => onRemoveSubscriber(sub.id)}
                    loading={removingSubscriberId === sub.id}
                  >
                    {removeSubscriberLabel}
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
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  privateNotice: {
    borderRadius: 10,
    padding: 12,
  },
  privateNoticeText: {
    fontSize: 13,
    lineHeight: 19,
  },
  dailyInfoBox: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  dailyInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  dailyInfoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  dailyActionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  dailyActionButton: {
    flexGrow: 1,
    minWidth: 132,
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
