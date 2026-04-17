import React, { useState, useMemo, useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Separator } from '@/components/ui/Separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { ChannelCard } from '@/components/ChannelCard';
import { ChannelFormModal } from '@/components/ChannelFormModal';
import { ChannelModal } from '@/components/ChannelModal';
import { NowStatusModal } from '@/components/NowStatusModal';

import { useAuth } from '@/hooks/useAuth';
import { useActionModal } from '@/hooks/useActionModal';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import {
  selectUserChannels,
  selectAllDailyChannels,
} from '@/store/slices/channelsSlice';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { exitDemoMode } from '@/store/actions/demoActions';
import { saveProfile, saveStatus, clearStatus } from '@/store/actions/userActions';
import {
  createCustomChannel,
  editCustomChannel,
  deleteCustomChannel,
  unsubscribeFromChannel,
  refreshChannelInviteCode,
  removeChannelSubscriber,
} from '@/store/actions/channelActions';
import { AVATAR_PRESETS, CUSTOM_CHANNEL_LIMIT } from '@/models/constants';
import type { AvatarPreset, Channel, UserStatus } from '@/models/types';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';
import { formatExactExpiry } from '@/lib/timeUtils';

export default function AccountScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { signOut, exitDemo } = useAuth();
  const { confirm } = useActionModal();
  const { addToast } = useToast();
  const { theme } = useTheme();

  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const channels = useAppSelector((state) => state.channels.items);
  const usersMap = useAppSelector(selectAllUsersMapById);
  const outgoingRequests = useAppSelector((state) => state.invites.outgoing);

  const myChannels = useAppSelector((state) =>
    selectUserChannels(state, state.users.currentUser?.id || '')
  );
  const subscribedChannels = useMemo(
    () =>
      channels.filter(
        (ch) =>
          ch.ownerId !== currentUser?.id &&
          ch.subscribers.includes(currentUser?.id || '')
      ),
    [channels, currentUser?.id]
  );
  const customChannelCount = useMemo(
    () => myChannels.filter((c) => !c.isDaily).length,
    [myChannels]
  );

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState(
    currentUser?.firstName || ''
  );
  const [editLastName, setEditLastName] = useState(
    currentUser?.lastName || ''
  );
  const [editFunFact, setEditFunFact] = useState(
    currentUser?.funFact || ''
  );
  const [editAvatar, setEditAvatar] = useState<AvatarPreset>(
    currentUser?.avatar || 'moon'
  );

  // Channel modal state
  const [channelFormOpen, setChannelFormOpen] = useState(false);
  const [channelFormMode, setChannelFormMode] = useState<
    'create' | 'edit'
  >('create');
  const [editingChannel, setEditingChannel] = useState<Channel | undefined>();
  const [channelDetailOpen, setChannelDetailOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );
  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );
  const [removingSubscriberId, setRemovingSubscriberId] = useState<
    string | null
  >(null);

  // Status modal state
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    try {
      await dispatch(
        saveProfile({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          funFact: editFunFact.trim(),
          avatar: editAvatar,
        })
      ).unwrap();
      addToast({ type: 'success', title: 'Profile updated!' });
      setEditingProfile(false);
    } catch {
      addToast({ type: 'error', title: 'Failed to update profile' });
    }
  };

  const handleCreateChannel = async (data: {
    name: string;
    description: string;
    color: string;
  }) => {
    if (!currentUser) return;
    try {
      await dispatch(createCustomChannel(data)).unwrap();
      addToast({ type: 'success', title: 'Channel created!' });
      setChannelFormOpen(false);
    } catch {
      addToast({ type: 'error', title: 'Failed to create channel' });
    }
  };

  const handleEditChannel = async (data: {
    name: string;
    description: string;
    color: string;
  }) => {
    if (!editingChannel) return;
    try {
      await dispatch(
        editCustomChannel({ channel: editingChannel, data })
      ).unwrap();
      addToast({ type: 'success', title: 'Channel updated!' });
      setChannelFormOpen(false);
      setEditingChannel(undefined);
    } catch {
      addToast({ type: 'error', title: 'Failed to update channel' });
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    const ok = await confirm({
      title: 'Delete Channel',
      message:
        'This will permanently delete this channel and all its posts. Continue?',
      destructive: true,
    });
    if (!ok) return;
    try {
      await dispatch(deleteCustomChannel(channelId)).unwrap();
      addToast({ type: 'success', title: 'Channel deleted' });
    } catch {
      addToast({ type: 'error', title: 'Failed to delete channel' });
    }
  };

  const handleUnsubscribe = async (channelId: string) => {
    const ok = await confirm({
      title: 'Unsubscribe',
      message: 'You will no longer see posts from this channel.',
    });
    if (!ok) return;
    try {
      await dispatch(
        unsubscribeFromChannel({ channelId, userId: currentUser?.id || '' })
      ).unwrap();
      addToast({ type: 'success', title: 'Unsubscribed' });
    } catch {
      addToast({ type: 'error', title: 'Failed to unsubscribe' });
    }
  };

  const handleSignOut = async () => {
    try {
      if (isDemo) {
        await exitDemo();
        dispatch(exitDemoMode());
        router.replace('/');
      } else {
        await signOut();
        router.replace('/');
      }
    } catch {
      addToast({ type: 'error', title: 'Failed to sign out' });
    }
  };

  const handleSaveStatus = async (status: UserStatus) => {
    try {
      await dispatch(saveStatus(status)).unwrap();
      addToast({ type: 'success', title: 'Status updated!' });
      setStatusModalOpen(false);
    } catch {
      addToast({ type: 'error', title: 'Failed to set status' });
    }
  };

  const handleClearStatus = async () => {
    try {
      await dispatch(clearStatus()).unwrap();
      addToast({ type: 'success', title: 'Status cleared' });
      setStatusModalOpen(false);
    } catch {
      addToast({ type: 'error', title: 'Failed to clear status' });
    }
  };

  if (!currentUser) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.mutedForeground }}>Loading...</Text>
      </View>
    );
  }

  const existingNames = myChannels.map((ch) => ch.name);
  const canCreateChannel =
    (currentUser.customChannelCount || 0) < CUSTOM_CHANNEL_LIMIT;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 8 }
        ]}
        keyboardShouldPersistTaps="handled"
      >
      <Tabs defaultValue="account">
        <TabsList style={{ marginBottom: 16 }}>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="my-channels">My Channels</TabsTrigger>
          <TabsTrigger value="subscribed">Subscribed</TabsTrigger>
        </TabsList>

        {/* ===== ACCOUNT TAB ===== */}
        <TabsContent value="account">
          <Card style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <Avatar preset={currentUser.avatar} size="xl" />
              <Text style={[styles.profileName, { color: theme.foreground }]}>
                {currentUser.firstName} {currentUser.lastName}
              </Text>
              <Text
                style={[
                  styles.profileEmail,
                  { color: theme.mutedForeground },
                ]}
              >
                {currentUser.email}
              </Text>
              {currentUser.funFact ? (
                <Text
                  style={[
                    styles.profileFunFact,
                    { color: theme.mutedForeground },
                  ]}
                >
                  💡 {currentUser.funFact}
                </Text>
              ) : null}
            </View>

            {/* Set / Edit Status */}
            <Pressable
              onPress={() => setStatusModalOpen(true)}
              style={[styles.statusButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.statusButtonText, { color: theme.foreground }]}>
                {currentUser.status && Date.now() < currentUser.status.expiresAt
                  ? `${currentUser.status.emoji} ${currentUser.status.text}`
                  : 'Set a status'}
              </Text>
            </Pressable>
            {currentUser.status && Date.now() < currentUser.status.expiresAt ? (
              <Text style={[styles.statusExpiry, { color: theme.mutedForeground }]}>
                {formatExactExpiry(currentUser.status.expiresAt)}
              </Text>
            ) : null}

            {editingProfile ? (
              <View style={styles.editForm}>
                <View style={styles.field}>
                  <Label>First Name</Label>
                  <Input
                    value={editFirstName}
                    onChangeText={setEditFirstName}
                  />
                </View>
                <View style={styles.field}>
                  <Label>Last Name</Label>
                  <Input
                    value={editLastName}
                    onChangeText={setEditLastName}
                  />
                </View>
                <View style={styles.field}>
                  <Label>Fun Fact</Label>
                  <Textarea
                    value={editFunFact}
                    onChangeText={setEditFunFact}
                    maxLength={200}
                  />
                </View>
                <View style={styles.field}>
                  <Label>Avatar</Label>
                  <View style={styles.avatarGrid}>
                    {AVATAR_PRESETS.map((preset) => (
                      <Pressable
                        key={preset}
                        onPress={() => setEditAvatar(preset)}
                        style={[
                          styles.avatarOption,
                          editAvatar === preset && {
                            borderColor: theme.primary,
                            borderWidth: 2,
                          },
                        ]}
                      >
                        <Avatar preset={preset} size="sm" />
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.editActions}>
                  <Button
                    variant="tertiary"
                    onPress={() => setEditingProfile(false)}
                  >
                    Cancel
                  </Button>
                  <Button onPress={handleSaveProfile}>Save</Button>
                </View>
              </View>
            ) : (
              <Button
                variant="outline"
                onPress={() => setEditingProfile(true)}
                style={{ marginTop: 12 }}
              >
                Edit Profile
              </Button>
            )}
          </Card>

          {/* Sign Out */}
          <Separator style={{ marginVertical: 16 }} />
          <View style={styles.bottomSection}>
            <Button
              variant="destructive"
              onPress={handleSignOut}
            >
              Sign Out
            </Button>
          </View>
        </TabsContent>

        {/* ===== MY CHANNELS TAB ===== */}
        <TabsContent value="my-channels">
          {canCreateChannel && (
            <Button
              onPress={() => {
                setChannelFormMode('create');
                setEditingChannel(undefined);
                setChannelFormOpen(true);
              }}
              style={{ marginBottom: 16 }}
            >
              {`+ New Channel (${customChannelCount}/${CUSTOM_CHANNEL_LIMIT})`}
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
            <Text
              style={[styles.emptyText, { color: theme.mutedForeground }]}
            >
              You don't have any channels yet.
            </Text>
          )}
        </TabsContent>

        {/* ===== SUBSCRIBED TAB ===== */}
        <TabsContent value="subscribed">
          <Button
            variant="outline"
            onPress={() => router.push('/join-channel')}
            style={{ marginBottom: 16 }}
          >
            {`🤝 Join a Channel`}
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
            <Text
              style={[styles.emptyText, { color: theme.mutedForeground }]}
            >
              You're not subscribed to any channels yet.
            </Text>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ChannelFormModal
        isOpen={channelFormOpen}
        onClose={() => {
          setChannelFormOpen(false);
          setEditingChannel(undefined);
        }}
        onSubmit={
          channelFormMode === 'create'
            ? handleCreateChannel
            : handleEditChannel
        }
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
                    await dispatch(
                      refreshChannelInviteCode(selectedChannel.id)
                    ).unwrap();
                    addToast({
                      type: 'success',
                      title: 'Invite code refreshed',
                    });
                  } catch {
                    addToast({
                      type: 'error',
                      title: 'Failed to refresh invite',
                    });
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
                      removeChannelSubscriber({
                        channelId: selectedChannel.id,
                        subscriberId,
                      })
                    ).unwrap();
                    addToast({
                      type: 'success',
                      title: 'Subscriber removed',
                    });
                  } catch {
                    addToast({
                      type: 'error',
                      title: 'Failed to remove subscriber',
                    });
                  } finally {
                    setRemovingSubscriberId(null);
                  }
                }
              : undefined
          }
          removingSubscriberId={removingSubscriberId}
        />
      )}

      {/* Status modal */}
      <NowStatusModal
        visible={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onSave={handleSaveStatus}
        onClear={handleClearStatus}
        currentStatus={currentUser.status}
      />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    padding: 20,
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    gap: 4,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  profileEmail: {
    fontSize: 14,
  },
  profileFunFact: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
    alignSelf: 'center',
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusExpiry: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  editForm: {
    width: '100%',
    marginTop: 16,
    gap: 12,
  },
  field: {
    gap: 6,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarOption: {
    borderRadius: 20,
    padding: 3,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  bottomSection: {
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingTop: 24,
    fontStyle: 'italic',
  },
});
