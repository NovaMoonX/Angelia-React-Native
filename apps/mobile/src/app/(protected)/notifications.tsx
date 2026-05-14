import React, { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { respondToJoinRequest, respondToCircleInviteRequest } from '@/store/actions/inviteActions';
import { ScreenHeader } from '@/components/ScreenHeader';
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
  const { theme } = useTheme();
  const channels = useAppSelector((state) => state.channels.items);
  const incoming = useAppSelector((state) => state.invites.incoming);
  const incomingCircleInvites = useAppSelector((state) => state.invites.incomingCircleInvites);
  const incomingConnRequests = useAppSelector((state) => state.connections.incomingRequests);
  const usersMap = useAppSelector(selectAllUsersMapById);

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
          { paddingTop: 12 }
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
                  You can now choose post alerts by Circle, tier, and attachments. Tap to set yours.
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={settingsNoticeAccent} style={styles.settingsRowChevron} />
          </Pressable>
        )}

        {/* Empty state — only shown when both request types are empty */}
        {pendingIncoming.length === 0 && pendingCircleInvites.length === 0 && pendingConnRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🫶</Text>
            <Text style={[styles.emptyText, { color: theme.mutedForeground, textAlign: 'center' }]}>
              You're all caught up!
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.mutedForeground, textAlign: 'center' }]}>
              Circle join requests, Circle invites, and connection requests will show up here.
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
    paddingBottom: 40,
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
  requestActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
});
