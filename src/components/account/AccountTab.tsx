import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Separator } from '@/components/ui/Separator';
import { Textarea } from '@/components/ui/Textarea';
import { NowStatusModal } from '@/components/NowStatusModal';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { exitDemoMode } from '@/store/actions/demoActions';
import { saveProfile, saveStatus, clearStatus } from '@/store/actions/userActions';
import { AVATAR_PRESETS } from '@/models/constants';
import type { AvatarPreset, UserStatus } from '@/models/types';
import { formatExactExpiry } from '@/lib/timeUtils';

export function AccountTab() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { signOut, exitDemo } = useAuth();
  const { addToast } = useToast();
  const { theme } = useTheme();

  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUser = useAppSelector((state) => state.users.currentUser);

  const [editingProfile, setEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState(currentUser?.firstName || '');
  const [editLastName, setEditLastName] = useState(currentUser?.lastName || '');
  const [editFunFact, setEditFunFact] = useState(currentUser?.funFact || '');
  const [editAvatar, setEditAvatar] = useState<AvatarPreset>(currentUser?.avatar || 'moon');
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  if (!currentUser) return null;

  const handleSaveProfile = async () => {
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

  return (
    <>
      <Card style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Avatar preset={currentUser.avatar} size="xl" />
          <Text style={[styles.profileName, { color: theme.foreground }]}>
            {currentUser.firstName} {currentUser.lastName}
          </Text>
          <Text style={[styles.profileEmail, { color: theme.mutedForeground }]}>
            {currentUser.email}
          </Text>
          {currentUser.funFact ? (
            <Text style={[styles.profileFunFact, { color: theme.mutedForeground }]}>
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
              <Input value={editFirstName} onChangeText={setEditFirstName} />
            </View>
            <View style={styles.field}>
              <Label>Last Name</Label>
              <Input value={editLastName} onChangeText={setEditLastName} />
            </View>
            <View style={styles.field}>
              <Label>Fun Fact</Label>
              <Textarea value={editFunFact} onChangeText={setEditFunFact} maxLength={200} />
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
              <Button variant="tertiary" onPress={() => setEditingProfile(false)}>
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

      <Separator style={{ marginVertical: 16 }} />
      <View style={styles.bottomSection}>
        <Button variant="destructive" onPress={handleSignOut}>
          Sign Out
        </Button>
      </View>

      <NowStatusModal
        visible={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onSave={handleSaveStatus}
        onClear={handleClearStatus}
        currentStatus={currentUser.status}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
});
