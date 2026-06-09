import React, { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { useActionModal } from '@/hooks/useActionModal';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { selectUnreadNotificationsInboxSections } from '@/store/crossSelectors/userInboxSelectors';
import { markUserInboxItemsRead } from '@/services/firebase/firestore';
import { getPostPreviewText } from '@/lib/message/messagePreview.utils';
import {
  getUserInboxItemLabel,
  getUserInboxItemMeta,
  getUserInboxItemPreview,
  openUserInboxItem,
  type UserInboxItemDisplayContext,
  type UserInboxItemRenderOptions,
} from '@/lib/userInbox/userInbox.utils';
import { respondToJoinRequest, respondToCircleInviteRequest } from '@/store/actions/inviteActions';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { UserInboxItem } from '@/models/types';
import {
  NOTIFICATION_SETTINGS_NOTICE_ACCENT,
  NOTIFICATION_SETTINGS_NOTICE_BADGE_SEEN_KEY,
  NOTIFICATION_SETTINGS_NOTICE_SEEN_KEY,
  NOTIFICATION_SETTINGS_NOTICE_VERSION,
} from '@/models/constants';

export default function NotificationsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { confirm } = useActionModal();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const channels = useAppSelector((state) => state.channels.items);
  const incoming = useAppSelector((state) => state.invites.incoming);
  const incomingCircleInvites = useAppSelector((state) => state.invites.incomingCircleInvites);
  const incomingConnRequests = useAppSelector((state) => state.connections.incomingRequests);
  const usersMap = useAppSelector(selectAllUsersMapById);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const posts = useAppSelector((state) => state.posts.items);
  const { yourPostGroups, otherActivityItems } = useAppSelector(selectUnreadNotificationsInboxSections);

  const pendingIncoming = incoming.filter((r) => r.status === 'pending');
  const pendingCircleInvites = incomingCircleInvites.filter((r) => r.status === 'pending');
  const pendingConnRequests = incomingConnRequests.filter((r) => r.status === 'pending');
  const [showSettingsReleaseNotice, setShowSettingsReleaseNotice] = useState(false);
  const settingsNoticeAccent = NOTIFICATION_SETTINGS_NOTICE_ACCENT;
  const settingsNoticeBackground = `${NOTIFICATION_SETTINGS_NOTICE_ACCENT}1F`;
  const settingsNoticeBorder = `${NOTIFICATION_SETTINGS_NOTICE_ACCENT}66`;

  const refreshSettingsReleaseNotice = useCallback(() => {
    void AsyncStorage.getItem(
      NOTIFICATION_SETTINGS_NOTICE_SEEN_KEY(NOTIFICATION_SETTINGS_NOTICE_VERSION),
    )
      .then((seenValue) => {
        setShowSettingsReleaseNotice(seenValue !== 'true');
        return null;
      })
      .catch(() => {
        setShowSettingsReleaseNotice(true);
        return null;
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void AsyncStorage.setItem(
        NOTIFICATION_SETTINGS_NOTICE_BADGE_SEEN_KEY(NOTIFICATION_SETTINGS_NOTICE_VERSION),
        'true',
      ).catch(() => {
        return null;
      });
      refreshSettingsReleaseNotice();
      return undefined;
    }, [refreshSettingsReleaseNotice]),
  );

  const handleRespondToRequest = async (
    requestId: string,
    accept: boolean
  ) => {
    const request = pendingIncoming.find((r) => r.id === requestId);
    if (!request) return;
    try {
      await dispatch(
        respondToJoinRequest({ request, accept })
      ).unwrap();
      addToast({
        type: 'success',
        title: accept ? 'Request accepted' : 'Request declined',
      });
    } catch {
      addToast({ type: 'error', title: 'Failed to respond' });
    }
  };

  const handleOpenInboxItem = useCallback(async (item: UserInboxItem) => {
    if (!currentUser) return;
    await openUserInboxItem(currentUser.id, item);
  }, [currentUser]);

  const handleMarkSectionSeen = useCallback(async (
    items: UserInboxItem[],
    sectionLabel: string,
  ) => {
    if (!currentUser || items.length === 0) {
      return;
    }

    const ok = await confirm({
      title: `Mark ${sectionLabel} as seen?`,
      message: `This clears ${items.length} unread ${items.length === 1 ? 'item' : 'items'} in ${sectionLabel}. Nothing is deleted — just marked as seen.`,
      confirmText: 'Mark all seen',
    });
    if (!ok) {
      return;
    }

    try {
      await markUserInboxItemsRead(
        currentUser.id,
        items.map((item) => {
          return item.id;
        }),
      );
      addToast({ type: 'success', title: 'Marked as seen!' });
    } catch {
      addToast({ type: 'error', title: 'Could not mark items as seen' });
    }
  }, [addToast, confirm, currentUser]);

  const yourPostSectionItems = yourPostGroups.flatMap((group) => {
    return group.items;
  });

  const buildInboxDisplayContext = (
    item: UserInboxItem,
    postId?: string,
  ): UserInboxItemDisplayContext => {
    const resolvedPostId = postId ?? ('postId' in item ? item.postId : undefined);
    const post = resolvedPostId
      ? posts.find((entry) => {
        return entry.id === resolvedPostId;
      })
      : undefined;
    const channelId = item.type === 'new_post'
      ? item.channelId
      : post?.channelId;
    const channel = channelId
      ? channels.find((entry) => {
        return entry.id === channelId;
      })
      : undefined;

    return {
      post,
      channel,
      usersById: usersMap,
      currentUserId: currentUser?.id,
    };
  };

  const renderInboxActivityItem = (
    item: UserInboxItem,
    postId?: string,
    renderOptions?: UserInboxItemRenderOptions,
  ) => {
    const actor = usersMap[item.actorId];
    const displayContext = buildInboxDisplayContext(item, postId);
    const preview = getUserInboxItemPreview(item, displayContext, renderOptions);
    const meta = getUserInboxItemMeta(item, displayContext);

    return (
      <Pressable
        onPress={() => {
          void handleOpenInboxItem(item);
        }}
        style={styles.activityItemRow}
      >
        <Avatar user={actor} size="sm" showStatus={false} />
        <View style={styles.activityItemContent}>
          <Text style={[styles.activityItemTitle, { color: theme.foreground }]}>
            {getUserInboxItemLabel(item)}
          </Text>
          {meta.length > 0 ? (
            <View style={styles.activityMetaRow}>
              {meta.map((chip) => {
                const hasTierColors = chip.badgeBg != null && chip.badgeText != null;
                const chipBackground = hasTierColors ? chip.badgeBg : theme.secondary;
                const chipBorder = hasTierColors ? chip.badgeBg : theme.border;
                const chipTextColor = hasTierColors ? chip.badgeText : theme.mutedForeground;
                return (
                  <View
                    key={`${item.id}-${chip.label}`}
                    style={[
                      styles.activityMetaChip,
                      {
                        backgroundColor: chipBackground ?? theme.secondary,
                        borderColor: chipBorder ?? theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.activityMetaChipText,
                        { color: chipTextColor ?? theme.mutedForeground },
                      ]}
                      numberOfLines={1}
                    >
                      {chip.emoji} {chip.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          {preview ? (
            <Text style={[styles.activityItemPreview, { color: theme.mutedForeground }]} numberOfLines={2}>
              {preview}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderSectionHeader = (
    title: string,
    items: UserInboxItem[],
    sectionLabel: string,
  ) => {
    if (items.length === 0) {
      return null;
    }

    return (
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.foreground, flex: 1 }]} numberOfLines={2}>
          {title}
        </Text>
        <Button
          variant="outline"
          size="sm"
          onPress={() => {
            void handleMarkSectionSeen(items, sectionLabel);
          }}
        >
          Mark all seen
        </Button>
      </View>
    );
  };

  const handleRespondToCircleInvite = async (
    requestId: string,
    accept: boolean,
  ) => {
    const request = pendingCircleInvites.find((r) => r.id === requestId);
    if (!request) return;
    try {
      await dispatch(respondToCircleInviteRequest({ request, accept })).unwrap();
      addToast({
        type: 'success',
        title: accept ? 'Invite accepted' : 'Invite declined',
      });
    } catch {
      addToast({ type: 'error', title: 'Failed to respond' });
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Notifications"
        rightAction={
          <Pressable
            onPress={() => router.push('/(protected)/notification-settings')}
            hitSlop={8}
            style={{ marginRight: 4 }}
          >
            <Feather name="settings" size={22} color={theme.foreground} />
          </Pressable>
        }
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 12, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Release notice area: one-time callout for new notification controls */}
        {showSettingsReleaseNotice && (
          <Pressable
            onPress={() => router.push('/(protected)/notification-settings')}
            style={({ pressed }) => [
              styles.settingsRow,
              {
                backgroundColor: settingsNoticeBackground,
                borderColor: settingsNoticeBorder,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={styles.settingsRowLeft}>
              <Text style={[styles.settingsRowEmoji, { color: settingsNoticeAccent }]}>✨</Text>
              <View style={styles.settingsRowTextWrap}>
                <Text style={[styles.settingsRowTitle, { color: settingsNoticeAccent }]}> 
                  New Notification Controls
                </Text>
                <Text style={[styles.settingsRowSub, { color: settingsNoticeAccent }]}> 
                  You can now whether new reactions or messages for your posts ping you. Both are enabled by default. 
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={settingsNoticeAccent} style={styles.settingsRowChevron} />
          </Pressable>
        )}

        {yourPostGroups.length > 0 ? (
          <>
            {renderSectionHeader(
              'Activity on your posts',
              yourPostSectionItems,
              'Activity on your posts',
            )}
            {yourPostGroups.map((group) => {
              const post = posts.find((entry) => {
                return entry.id === group.postId;
              });
              const postPreview = getPostPreviewText(post);
              return (
                <Card key={group.postId} style={styles.requestCard}>
                  <Text style={[styles.activityPostTitle, { color: theme.foreground }]}>
                    Your post
                  </Text>
                  {postPreview ? (
                    <Text
                      style={[styles.activityPostPreview, { color: theme.mutedForeground }]}
                      numberOfLines={2}
                    >
                      {postPreview}
                    </Text>
                  ) : null}
                  {group.items.map((item) => {
                    return (
                      <React.Fragment key={item.id}>
                        {renderInboxActivityItem(item, group.postId, { groupedUnderYourPost: true })}
                      </React.Fragment>
                    );
                  })}
                </Card>
              );
            })}
          </>
        ) : null}

        {otherActivityItems.length > 0 ? (
          <>
            {renderSectionHeader('Activity', otherActivityItems, 'Activity')}
            {otherActivityItems.map((item) => {
              const postId = 'postId' in item ? item.postId : undefined;
              return (
                <Card key={item.id} style={styles.requestCard}>
                  {renderInboxActivityItem(item, postId)}
                </Card>
              );
            })}
          </>
        ) : null}

        {/* Empty state */}
        {pendingIncoming.length === 0
          && pendingCircleInvites.length === 0
          && pendingConnRequests.length === 0
          && yourPostGroups.length === 0
          && otherActivityItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🫶</Text>
            <Text style={[styles.emptyText, { color: theme.mutedForeground, textAlign: 'center' }]}>
              You're all caught up!
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.mutedForeground, textAlign: 'center' }]}>
              Replies, new posts, and requests will show up here.
            </Text>
          </View>
        ) : (
          <>
            {/* Connection requests */}
            {pendingConnRequests.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
                  Connection Requests ({pendingConnRequests.length})
                </Text>
                {pendingConnRequests.map((req) => {
                  const requester = usersMap[req.fromId];
                  return (
                    <Card key={req.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <Avatar user={requester} size="sm" showStatus={false} />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={[styles.requestName, { color: theme.foreground }]}>
                            {requester?.firstName || 'Unknown'}{' '}
                            {requester?.lastName || 'User'}
                          </Text>
                          <Text style={[styles.requestChannel, { color: theme.mutedForeground }]}>
                            wants to connect with you
                          </Text>
                        </View>
                      </View>
                      <View style={styles.requestActions}>
                        <Button
                          size="sm"
                          onPress={() => router.push({
                            pathname: '/(protected)/connection-request/[id]',
                            params: { id: req.id },
                          })}
                        >
                          View Request
                        </Button>
                      </View>
                    </Card>
                  );
                })}
              </>
            )}

            {/* Circle join requests */}
            {pendingIncoming.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
                  Circle Join Requests ({pendingIncoming.length})
                </Text>
                {pendingIncoming.map((req) => {
                  const requester = usersMap[req.requesterId];
                  const ch = channels.find((c) => c.id === req.channelId);
                  return (
                    <Card key={req.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <Avatar
                          user={requester}
                          size="sm"
                        />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text
                            style={[
                              styles.requestName,
                              { color: theme.foreground },
                            ]}
                          >
                            {requester?.firstName || 'Unknown'}{' '}
                            {requester?.lastName || 'User'}
                          </Text>
                          <Text
                            style={[
                              styles.requestChannel,
                              { color: theme.mutedForeground },
                            ]}
                          >
                            wants to join{' '}
                            <Text style={{ fontWeight: '600' }}>
                              {ch?.name || 'circle'}
                            </Text>
                          </Text>
                        </View>
                      </View>
                      {req.message ? (
                        <Text
                          style={[
                            styles.requestMessage,
                            { color: theme.foreground },
                          ]}
                        >
                          &quot;{req.message}&quot;
                        </Text>
                      ) : null}
                      <View style={styles.requestActions}>
                        <Button
                          variant="destructive"
                          size="sm"
                          onPress={() =>
                            handleRespondToRequest(req.id, false)
                          }
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          onPress={() =>
                            handleRespondToRequest(req.id, true)
                          }
                        >
                          Accept
                        </Button>
                      </View>
                    </Card>
                  );
                })}
              </>
            )}

            {/* Circle invites */}
            {pendingCircleInvites.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Circle Invites ({pendingCircleInvites.length})</Text>
                {pendingCircleInvites.map((req) => {
                  const inviter = usersMap[req.inviterId];
                  const ch = channels.find((c) => c.id === req.channelId);
                  return (
                    <Card key={req.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <Avatar user={inviter} size="sm" showStatus={false} />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={[styles.requestName, { color: theme.foreground }]}> 
                            {inviter?.firstName || 'Unknown'} {inviter?.lastName || 'User'}
                          </Text>
                          <Text style={[styles.requestChannel, { color: theme.mutedForeground }]}> 
                            invited you to join{' '}
                            <Text style={{ fontWeight: '600' }}>{ch?.name || 'circle'}</Text>
                          </Text>
                        </View>
                      </View>
                      <View style={styles.requestActions}>
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => router.push({ pathname: '/(protected)/circle-invite/[id]', params: { id: req.id } } as never)}
                        >
                          View Invite
                        </Button>
                        <Button variant="destructive" size="sm" onPress={() => handleRespondToCircleInvite(req.id, false)}>
                          Decline
                        </Button>
                        <Button size="sm" onPress={() => handleRespondToCircleInvite(req.id, true)}>
                          Accept
                        </Button>
                      </View>
                    </Card>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingsRowTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  settingsRowEmoji: {
    fontSize: 26,
  },
  settingsRowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingsRowSub: {
    fontSize: 12,
    lineHeight: 17,
    flexShrink: 1,
    marginTop: 1,
  },
  settingsRowChevron: {
    marginLeft: 12,
    flexShrink: 0,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  requestCard: {
    padding: 16,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestName: {
    fontSize: 14,
    fontWeight: '600',
  },
  requestChannel: {
    fontSize: 13,
  },
  requestMessage: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  activityPostTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  activityPostPreview: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  activityMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  activityMetaChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  activityMetaChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activityItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 8,
  },
  activityItemContent: {
    flex: 1,
    gap: 4,
  },
  activityItemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityItemPreview: {
    fontSize: 13,
    lineHeight: 18,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
});
