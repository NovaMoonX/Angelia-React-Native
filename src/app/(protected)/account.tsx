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
import { Select } from '@/components/ui/Select';
import { Separator } from '@/components/ui/Separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { Toggle } from '@/components/ui/Toggle';
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
import { saveProfile, saveStatus, clearStatus, saveTierPrefs } from '@/store/actions/userActions';
import { saveNotificationSettings } from '@/store/actions/notificationActions';
import {
  createCustomChannel,
  editCustomChannel,
  deleteCustomChannel,
  unsubscribeFromChannel,
  refreshChannelInviteCode,
  removeChannelSubscriber,
} from '@/store/actions/channelActions';
import { AVATAR_PRESETS, CUSTOM_CHANNEL_LIMIT, POST_TIERS, ALL_POST_TIERS } from '@/models/constants';
import type { AvatarPreset, Channel, UserStatus, PostTier } from '@/models/types';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';
import { formatExactExpiry } from '@/lib/timeUtils';
import { getDeviceTimeZone } from '@/services/notifications';

// ---- Notification helpers ----

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const suffix = i < 12 ? 'AM' : 'PM';
  const display = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return { value: String(i), text: `${display}:00 ${suffix}` };
});

const COMMON_TIMEZONES = [
  { value: 'Pacific/Honolulu',    text: 'Hawaii (UTC−10)' },
  { value: 'America/Anchorage',   text: 'Alaska (UTC−9)' },
  { value: 'America/Los_Angeles', text: 'Pacific (UTC−8/−7)' },
  { value: 'America/Denver',      text: 'Mountain (UTC−7/−6)' },
  { value: 'America/Chicago',     text: 'Central (UTC−6/−5)' },
  { value: 'America/New_York',    text: 'Eastern (UTC−5/−4)' },
  { value: 'America/Halifax',     text: 'Atlantic (UTC−4/−3)' },
  { value: 'America/Sao_Paulo',   text: 'Brasilia (UTC−3)' },
  { value: 'Atlantic/Azores',     text: 'Azores (UTC−1/0)' },
  { value: 'Europe/London',       text: 'London (UTC+0/+1)' },
  { value: 'Europe/Paris',        text: 'Central Europe (UTC+1/+2)' },
  { value: 'Europe/Helsinki',     text: 'Eastern Europe (UTC+2/+3)' },
  { value: 'Europe/Moscow',       text: 'Moscow (UTC+3)' },
  { value: 'Asia/Dubai',          text: 'Gulf (UTC+4)' },
  { value: 'Asia/Karachi',        text: 'Pakistan (UTC+5)' },
  { value: 'Asia/Kolkata',        text: 'India (UTC+5:30)' },
  { value: 'Asia/Dhaka',          text: 'Bangladesh (UTC+6)' },
  { value: 'Asia/Bangkok',        text: 'Indochina (UTC+7)' },
  { value: 'Asia/Singapore',      text: 'Singapore (UTC+8)' },
  { value: 'Asia/Tokyo',          text: 'Japan (UTC+9)' },
  { value: 'Australia/Sydney',    text: 'Sydney (UTC+10/+11)' },
  { value: 'Pacific/Auckland',    text: 'New Zealand (UTC+12/+13)' },
  { value: 'UTC',                 text: 'UTC' },
];

export default function AccountScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { signOut, exitDemo } = useAuth();
  const { confirm } = useActionModal();
  const { addToast } = useToast();
  const { theme } = useTheme();

  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const notificationSettings = useAppSelector(
    (state) => state.users.currentUserNotificationSettings,
  );
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

  // Notification settings state
  const notifEnabled = notificationSettings?.dailyPromptEnabled ?? true;
  const notifHour = String(notificationSettings?.dailyPromptHour ?? 12);
  const notifTZ = notificationSettings?.timeZone ?? getDeviceTimeZone();

  const handleToggleDailyPrompt = useCallback(async () => {
    try {
      await dispatch(
        saveNotificationSettings({ dailyPromptEnabled: !notifEnabled }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update notification settings' });
    }
  }, [dispatch, notifEnabled, addToast]);

  const handleChangeNotifHour = useCallback(
    async (value: string) => {
      try {
        await dispatch(
          saveNotificationSettings({ dailyPromptHour: parseInt(value, 10) }),
        ).unwrap();
      } catch {
        addToast({ type: 'error', title: 'Failed to update notification time' });
      }
    },
    [dispatch, addToast],
  );

  const handleChangeTimeZone = useCallback(
    async (value: string) => {
      try {
        await dispatch(saveNotificationSettings({ timeZone: value })).unwrap();
      } catch {
        addToast({ type: 'error', title: 'Failed to update time zone' });
      }
    },
    [dispatch, addToast],
  );

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

  const ALL_TIERS = ALL_POST_TIERS;

  const handleToggleTier = async (channelId: string, tier: PostTier) => {
    if (!currentUser) return;
    const currentPrefs = currentUser.channelTierPrefs ?? {};
    const savedTiers = currentPrefs[channelId];
    const activeTiers =
      !savedTiers || savedTiers.length === 0 ? ALL_TIERS : savedTiers;

    let newTiers: PostTier[];
    if (activeTiers.includes(tier)) {
      newTiers = activeTiers.filter((t) => t !== tier);
      if (newTiers.length === 0) return; // keep at least one tier active
    } else {
      newTiers = ALL_TIERS.filter((t) => t === tier || activeTiers.includes(t));
    }

    // Store as empty array when all 3 are active (meaning "no filter")
    const saveValue = newTiers.length === ALL_TIERS.length ? [] : newTiers;
    const newPrefs = { ...currentPrefs, [channelId]: saveValue };

    try {
      await dispatch(saveTierPrefs(newPrefs)).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update tier preferences' });
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
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
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
                  const activeTiers =
                    !saved || saved.length === 0 ? ALL_TIERS : saved;
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
            <Text
              style={[styles.emptyText, { color: theme.mutedForeground }]}
            >
              You're not subscribed to any channels yet.
            </Text>
          )}
        </TabsContent>

        {/* ===== NOTIFICATIONS TAB ===== */}
        <TabsContent value="notifications">
          <Card style={styles.notifCard}>
            <Text style={[styles.notifHeading, { color: theme.foreground }]}>
              Daily Prompt
            </Text>
            <Text style={[styles.notifSubtext, { color: theme.mutedForeground }]}>
              We'll send you a gentle nudge to share what's going on — no pressure,
              just a friendly reminder that people want to hear from you. 💛
            </Text>

            {/* Enable / disable toggle */}
            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifRowLabel, { color: theme.foreground }]}>
                  Get reminders
                </Text>
                <Text style={[styles.notifRowSub, { color: theme.mutedForeground }]}>
                  {notifEnabled ? "On — we'll remind you 💛" : 'Off'}
                </Text>
              </View>
              {notificationSettings ? (
                <Toggle checked={notifEnabled} onToggle={handleToggleDailyPrompt} />
              ) : (
                <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>Loading…</Text>
              )}
            </View>

            {notifEnabled && notificationSettings ? (
              <>
                <Separator style={{ marginVertical: 12 }} />

                {/* Time picker */}
                <View style={styles.notifField}>
                  <Label>Notification time</Label>
                  <Select
                    options={HOUR_OPTIONS}
                    value={notifHour}
                    onChange={handleChangeNotifHour}
                    placeholder="Pick a time"
                  />
                </View>

                {/* Timezone picker */}
                <View style={[styles.notifField, { marginTop: 12 }]}>
                  <Label>Time zone</Label>
                  <Select
                    options={COMMON_TIMEZONES}
                    value={notifTZ}
                    onChange={handleChangeTimeZone}
                    placeholder="Select your time zone"
                  />
                  <Text style={[styles.notifTZHint, { color: theme.mutedForeground }]}>
                    Auto-detected from your device on first sign-in. Change it here
                    if you prefer a different zone.
                  </Text>
                </View>
              </>
            ) : null}
          </Card>
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
  notifCard: {
    padding: 20,
    marginBottom: 16,
  },
  notifHeading: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  notifSubtext: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notifRowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  notifRowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  notifField: {
    gap: 6,
  },
  notifTZHint: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
});
