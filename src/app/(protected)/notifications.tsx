import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
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
  const router = useRouter();
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

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notifications',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.foreground,
          headerTitleStyle: { fontWeight: '700' },
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/(protected)/notification-settings')}
              hitSlop={8}
              style={{ marginRight: 4 }}
            >
              <Feather name="settings" size={22} color={theme.foreground} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: isDemo ? 12 : 12 }
        ]}
      >
        {/* Settings entry point */}
        <Pressable
          onPress={() => router.push('/(protected)/notification-settings')}
          style={({ pressed }) => [
            styles.settingsRow,
            { backgroundColor: theme.secondary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={styles.settingsRowLeft}>
            <Text style={styles.settingsRowEmoji}>🔔</Text>
            <View>
              <Text style={[styles.settingsRowTitle, { color: theme.secondaryForeground }]}>
                Daily Reminders
              </Text>
              <Text style={[styles.settingsRowSub, { color: theme.secondaryForeground }]}>
                Manage your daily prompt settings
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color={theme.secondaryForeground} />
        </Pressable>

        {/* Join requests */}
        {pendingIncoming.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🫶</Text>
            <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
              You're all caught up!
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.mutedForeground }]}>
              Channel join requests will show up here.
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
    </>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
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
    opacity: 0.8,
    marginTop: 1,
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
