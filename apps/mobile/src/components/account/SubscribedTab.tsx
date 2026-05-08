import React, { useState, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChannelCard } from '@/components/ChannelCard';
import { ChannelModal } from '@/components/ChannelModal';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { useActionModal } from '@/hooks/useActionModal';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import {
  unsubscribeFromChannel,
  refreshChannelInviteCode,
  removeChannelSubscriber,
} from '@/store/actions/channelActions';
import type { Channel } from '@/models/types';

export function SubscribedTab() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { confirm } = useActionModal();
  const { theme } = useTheme();

  const currentUser = useAppSelector((state) => state.users.currentUser);
  const channels = useAppSelector((state) => state.channels.items);
  const usersMap = useAppSelector(selectAllUsersMapById);
  const connections = useAppSelector((state) => state.connections.connections);

  // Only non-daily circles that the user explicitly joined
  const joinedCustomChannels = useMemo(
    () =>
      channels.filter(
        (ch) =>
          !ch.isDaily &&
          ch.ownerId !== currentUser?.id &&
          ch.subscribers.includes(currentUser?.id || ''),
      ),
    [channels, currentUser?.id],
  );

  const [channelDetailOpen, setChannelDetailOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [removingSubscriberId, setRemovingSubscriberId] = useState<string | null>(null);

  const selectedChannel = useMemo(
    () => channels.find((c: Channel) => c.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );

  if (!currentUser) return null;

  const handleUnsubscribe = async (channelId: string) => {
    const ok = await confirm({
      title: 'Unsubscribe',
      message: 'You will no longer see posts from this circle.',
    });
    if (!ok) return;
    try {
      await dispatch(
        unsubscribeFromChannel({ channelId, userId: currentUser.id })
      ).unwrap();
      addToast({ type: 'success', title: 'Unsubscribed' });
    } catch {
      addToast({ type: 'error', title: 'Failed to unsubscribe' });
    }
  };

  const connectionCount = connections.length;

  return (
    <>
      <Button
        variant="outline"
        onPress={() => router.push('/join-channel')}
        style={{ marginBottom: 16 }}
      >
        {`🤝 Join a Circle`}
      </Button>

      {/* Single card representing all connections' daily circles */}
      <Pressable onPress={() => router.push('/my-people')}>
        <Card style={styles.dailyCard}>
          <View style={styles.dailyHeader}>
            <Text style={[styles.dailyTitle, { color: theme.foreground }]}>
              Daily Circles
            </Text>
            <Feather name="chevron-right" size={16} color={theme.mutedForeground} />
          </View>
          <Text style={[styles.dailyDescription, { color: theme.mutedForeground }]}>
            Your connections share their daily updates here.
          </Text>
          <Text style={[styles.dailyMeta, { color: theme.mutedForeground }]}>
            {connectionCount} connection{connectionCount !== 1 ? 's' : ''}
          </Text>
        </Card>
      </Pressable>

      {joinedCustomChannels.map((ch) => (
        <ChannelCard
          key={ch.id}
          channel={ch}
          owner={usersMap[ch.ownerId]}
          onUnsubscribe={() => handleUnsubscribe(ch.id)}
          onClick={() => {
            setSelectedChannelId(ch.id);
            setChannelDetailOpen(true);
          }}
        />
      ))}

      {selectedChannel && (
        <ChannelModal
          isOpen={channelDetailOpen}
          onClose={() => {
            setChannelDetailOpen(false);
            setSelectedChannelId(null);
          }}
          channel={selectedChannel}
          subscribers={selectedChannel.subscribers
            .map((id) => usersMap[id])
            .filter(Boolean)}
          onRefreshInviteCode={
            selectedChannel.ownerId === currentUser.id
              ? async () => {
                  try {
                    await dispatch(refreshChannelInviteCode(selectedChannel.id)).unwrap();
                    addToast({ type: 'success', title: 'Invite code refreshed' });
                  } catch {
                    addToast({ type: 'error', title: 'Failed to refresh invite' });
                  }
                }
              : undefined
          }
          onRemoveSubscriber={
            selectedChannel.ownerId === currentUser.id
              ? async (subscriberId: string) => {
                  const ok = await confirm({
                    title: 'Remove Member',
                    message: 'This will remove them from this circle. Continue?',
                    destructive: true,
                  });
                  if (!ok) return;
                  setRemovingSubscriberId(subscriberId);
                  try {
                    await dispatch(
                      removeChannelSubscriber({ channelId: selectedChannel.id, subscriberId })
                    ).unwrap();
                    addToast({ type: 'success', title: 'Member removed' });
                  } catch {
                    addToast({ type: 'error', title: 'Failed to remove member' });
                  } finally {
                    setRemovingSubscriberId(null);
                  }
                }
              : undefined
          }
          removingSubscriberId={removingSubscriberId}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  dailyCard: {
    marginBottom: 12,
  },
  dailyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dailyTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  dailyDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  dailyMeta: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingTop: 24,
    fontStyle: 'italic',
  },
});
