import React, { useState, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button } from '@/components/ui/Button';
import { ChannelCard } from '@/components/ChannelCard';
import { ChannelFormModal } from '@/components/ChannelFormModal';
import { ChannelModal } from '@/components/ChannelModal';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { useActionModal } from '@/hooks/useActionModal';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectUserChannels } from '@/store/slices/channelsSlice';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import {
  createCustomChannel,
  editCustomChannel,
  deleteCustomChannel,
  refreshChannelInviteCode,
  removeChannelSubscriber,
} from '@/store/actions/channelActions';
import { CUSTOM_CHANNEL_LIMIT } from '@/models/constants';
import type { Channel } from '@/models/types';

export function MyChannelsTab() {
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { confirm } = useActionModal();
  const { theme } = useTheme();

  const currentUser = useAppSelector((state) => state.users.currentUser);
  const channels = useAppSelector((state) => state.channels.items);
  const usersMap = useAppSelector(selectAllUsersMapById);
  const myChannels = useAppSelector((state) =>
    selectUserChannels(state, state.users.currentUser?.id || '')
  );

  const customChannelCount = useMemo(
    () => myChannels.filter((c) => !c.isDaily).length,
    [myChannels],
  );
  const canCreateChannel = (currentUser?.customChannelCount || 0) < CUSTOM_CHANNEL_LIMIT;
  const existingNames = myChannels.map((ch) => ch.name);

  const [channelFormOpen, setChannelFormOpen] = useState(false);
  const [channelFormMode, setChannelFormMode] = useState<'create' | 'edit'>('create');
  const [editingChannel, setEditingChannel] = useState<Channel | undefined>();
  const [channelDetailOpen, setChannelDetailOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [removingSubscriberId, setRemovingSubscriberId] = useState<string | null>(null);

  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );

  if (!currentUser) return null;

  const handleCreateChannel = async (data: {
    name: string;
    description: string;
    color: string;
  }) => {
    try {
      await dispatch(createCustomChannel(data)).unwrap();
      addToast({ type: 'success', title: 'Circle created!' });
      setChannelFormOpen(false);
    } catch {
      addToast({ type: 'error', title: 'Failed to create circle' });
    }
  };

  const handleEditChannel = async (data: {
    name: string;
    description: string;
    color: string;
  }) => {
    if (!editingChannel) return;
    try {
      await dispatch(editCustomChannel({ channel: editingChannel, data })).unwrap();
      addToast({ type: 'success', title: 'Circle updated!' });
      setChannelFormOpen(false);
      setEditingChannel(undefined);
    } catch {
      addToast({ type: 'error', title: 'Failed to update circle' });
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    const ok = await confirm({
      title: 'Delete Circle',
      message: 'This will permanently delete this circle and all its posts. Continue?',
      destructive: true,
    });
    if (!ok) return;
    try {
      await dispatch(deleteCustomChannel(channelId)).unwrap();
      addToast({ type: 'success', title: 'Circle deleted' });
    } catch {
      addToast({ type: 'error', title: 'Failed to delete circle' });
    }
  };

  return (
    <>
      {canCreateChannel && (
        <Button
          onPress={() => {
            setChannelFormMode('create');
            setEditingChannel(undefined);
            setChannelFormOpen(true);
          }}
          style={{ marginBottom: 16 }}
        >
          {`+ New Circle (${customChannelCount}/${CUSTOM_CHANNEL_LIMIT})`}
        </Button>
      )}

      {myChannels.map((ch) => (
        <ChannelCard
          key={ch.id}
          channel={ch}
          isOwner
          onEdit={() => {
            setChannelFormMode('edit');
            setEditingChannel(ch);
            setChannelFormOpen(true);
          }}
          onDelete={() => handleDeleteChannel(ch.id)}
          onClick={() => {
            setSelectedChannelId(ch.id);
            setChannelDetailOpen(true);
          }}
        />
      ))}

      {myChannels.length === 0 && (
        <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
          You don't have any circles yet.
        </Text>
      )}

      <ChannelFormModal
        isOpen={channelFormOpen}
        onClose={() => {
          setChannelFormOpen(false);
          setEditingChannel(undefined);
        }}
        onSubmit={channelFormMode === 'create' ? handleCreateChannel : handleEditChannel}
        channel={editingChannel}
        mode={channelFormMode}
        existingChannelNames={existingNames}
      />

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
