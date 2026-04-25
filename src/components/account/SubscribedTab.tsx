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
  const usersMap = useAppSelector(selectAllUsersMapById);

  const subscribedChannels = useMemo(
    () =>
      channels.filter(
        (ch) =>
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
          onUnsubscribe={() => handleUnsubscribe(ch.id)}
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
