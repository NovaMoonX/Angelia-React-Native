import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
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
  const connectionChannels = useAppSelector((state) => state.channels.connectionChannels);
  const usersMap = useAppSelector(selectAllUsersMapById);

  const subscribedChannels = useMemo(() => {
    const explicitlySubscribed = channels.filter(
      (ch) =>
        ch.ownerId !== currentUser?.id &&
        ch.subscribers.includes(currentUser?.id || ''),
    );
    // De-duplicate: connection channels are daily channels of connected users.
    // They may already appear in items if the user also subscribed explicitly.
    const subscribedIds = new Set(explicitlySubscribed.map((ch) => ch.id));
    const connDaily = connectionChannels.filter((ch) => { return !subscribedIds.has(ch.id); });
    return [...explicitlySubscribed, ...connDaily];
  }, [channels, connectionChannels, currentUser?.id]);

  const [channelDetailOpen, setChannelDetailOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [removingSubscriberId, setRemovingSubscriberId] = useState<string | null>(null);

  const selectedChannel = useMemo(() => {
    const inItems = channels.find((c: Channel) => c.id === selectedChannelId);
    if (inItems) return inItems;
    return connectionChannels.find((c: Channel) => c.id === selectedChannelId) ?? null;
  }, [channels, connectionChannels, selectedChannelId]);

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

  return (
    <>
      <Button
        variant="outline"
        onPress={() => router.push('/join-channel')}
        style={{ marginBottom: 16 }}
      >
        {`🤝 Join a Circle`}
      </Button>

      {subscribedChannels.map((ch) => (
        <ChannelCard
          key={ch.id}
          channel={ch}
          owner={usersMap[ch.ownerId]}
          onUnsubscribe={!ch.isDaily ? () => handleUnsubscribe(ch.id) : undefined}
          onClick={() => {
            setSelectedChannelId(ch.id);
            setChannelDetailOpen(true);
          }}
        />
      ))}

      {subscribedChannels.length === 0 && (
        <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
          You're not a member of any circles yet.
        </Text>
      )}

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
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingTop: 24,
    fontStyle: 'italic',
  },
});
