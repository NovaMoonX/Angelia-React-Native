import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { respondToJoinRequest } from '@/store/actions/inviteActions';

export default function NotificationsScreen() {
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const isDemo = useAppSelector((state) => state.demo.isActive);
  const channels = useAppSelector((state) => state.channels.items);
  const incoming = useAppSelector((state) => state.invites.incoming);
  const usersMap = useAppSelector(selectAllUsersMapById);

  const pendingIncoming = incoming.filter((r) => r.status === 'pending');

  const handleRespondToRequest = async (
    requestId: string,
    accept: boolean
  ) => {
    const request = pendingIncoming.find((r) => r.id === requestId);
    if (!request) return;
    try {
      const result = await dispatch(
        respondToJoinRequest({ request, accept })
      );
      if (respondToJoinRequest.rejected.match(result)) {
        throw new Error('Failed to respond');
      }
      addToast({
        type: 'success',
        title: accept ? 'Request accepted' : 'Request declined',
      });
    } catch {
      addToast({ type: 'error', title: 'Failed to respond' });
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: isDemo ? 12 : insets.top + 8 }
      ]}
    >
      {pendingIncoming.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
            No notifications right now
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.mutedForeground }]}>
            Channel join requests will appear here.
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
            Channel Join Requests ({pendingIncoming.length})
          </Text>
          {pendingIncoming.map((req) => {
            const requester = usersMap[req.requesterId];
            const ch = channels.find((c) => c.id === req.channelId);
            return (
              <Card key={req.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <Avatar
                    preset={requester?.avatar || 'moon'}
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
                        {ch?.name || 'channel'}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
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
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  requestCard: {
    marginBottom: 12,
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
