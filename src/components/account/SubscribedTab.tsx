import React, { useState, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { saveTierPrefs } from '@/store/actions/userActions';
import { POST_TIERS, ALL_POST_TIERS } from '@/models/constants';
import type { Channel, PostTier } from '@/models/types';

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

  const handleToggleTier = async (channelId: string, tier: PostTier) => {
    const currentPrefs = currentUser.channelTierPrefs ?? {};
    const savedTiers = currentPrefs[channelId];
    const activeTiers = !savedTiers || savedTiers.length === 0 ? ALL_POST_TIERS : savedTiers;

    let newTiers: PostTier[];
    if (activeTiers.includes(tier)) {
      newTiers = activeTiers.filter((t) => t !== tier);
      if (newTiers.length === 0) return; // keep at least one tier active
    } else {
      newTiers = ALL_POST_TIERS.filter((t) => t === tier || activeTiers.includes(t));
    }

    const saveValue = newTiers.length === ALL_POST_TIERS.length ? [] : newTiers;
    const newPrefs = { ...currentPrefs, [channelId]: saveValue };

    try {
      await dispatch(saveTierPrefs(newPrefs)).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update tier preferences' });
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
        <View key={ch.id}>
          <ChannelCard
            channel={ch}
            owner={usersMap[ch.ownerId]}
            onUnsubscribe={() => handleUnsubscribe(ch.id)}
            onClick={() => {
              setSelectedChannelId(ch.id);
              setChannelDetailOpen(true);
            }}
          />
          <View style={styles.tierPrefsRow}>
            <Text style={[styles.tierPrefsLabel, { color: theme.mutedForeground }]}>
              Show tiers:
            </Text>
            {POST_TIERS.map((tierOption) => {
              const tier = tierOption.value;
              const saved = currentUser.channelTierPrefs?.[ch.id];
              const activeTiers = !saved || saved.length === 0 ? ALL_POST_TIERS : saved;
              const isActive = activeTiers.includes(tier);
              return (
                <Pressable
                  key={tier}
                  onPress={() => handleToggleTier(ch.id, tier)}
                  style={[
                    styles.tierTogglePill,
                    {
                      backgroundColor: isActive ? theme.primary : theme.muted,
                      borderColor: isActive ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text style={styles.tierToggleEmoji}>{tierOption.emoji}</Text>
                  <Text
                    style={[
                      styles.tierToggleLabel,
                      { color: isActive ? theme.primaryForeground : theme.mutedForeground },
                    ]}
                  >
                    {tierOption.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
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
  tierPrefsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: -6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  tierPrefsLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  tierTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 3,
  },
  tierToggleEmoji: {
    fontSize: 11,
  },
  tierToggleLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
