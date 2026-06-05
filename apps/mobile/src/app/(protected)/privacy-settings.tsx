import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { savePublicDisplayName, saveIdentityPrivacy } from '@/store/actions/userActions';
import {
  generateUniquePublicDisplayName,
} from '@/lib/user/publicDisplayName';

export default function PrivacySettingsScreen() {
  const { theme } = useTheme();
  const { addToast } = useToast();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.users.currentUser);

  const [nameDraft, setNameDraft] = useState(currentUser?.publicDisplayName ?? '');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (currentUser?.publicDisplayName) {
      setNameDraft(currentUser.publicDisplayName);
    }
  }, [currentUser?.publicDisplayName]);

  const hideName = currentUser?.hideNameFromNonConnections !== false;
  const hideAvatar = currentUser?.hideAvatarFromNonConnections !== false;

  const handleSaveName = useCallback(async () => {
    setSavingName(true);
    try {
      await dispatch(savePublicDisplayName(nameDraft)).unwrap();
      addToast({ type: 'success', title: 'Public display name updated' });
    } catch (err) {
      const message = typeof err === 'string' ? err : 'Failed to update name';
      addToast({ type: 'error', title: message });
    } finally {
      setSavingName(false);
    }
  }, [dispatch, nameDraft, addToast]);

  const handleGenerateName = useCallback(() => {
    if (!currentUser) return;
    const taken = new Set<string>();
    setNameDraft(generateUniquePublicDisplayName(currentUser.avatar, taken));
  }, [currentUser]);

  const handleToggleHideName = useCallback(async () => {
    try {
      await dispatch(
        saveIdentityPrivacy({ hideNameFromNonConnections: !hideName }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update privacy setting' });
    }
  }, [dispatch, hideName, addToast]);

  const handleToggleHideAvatar = useCallback(async () => {
    try {
      await dispatch(
        saveIdentityPrivacy({ hideAvatarFromNonConnections: !hideAvatar }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update privacy setting' });
    }
  }, [dispatch, hideAvatar, addToast]);

  if (!currentUser) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader title="Privacy" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.groupTitle, { color: theme.foreground }]}>Public display name</Text>
          <Text style={[styles.hint, { color: theme.mutedForeground }]}>
            Shown in shared Circles to people you have not connected with directly.
          </Text>
          <Label>Name</Label>
          <Input value={nameDraft} onChangeText={setNameDraft} autoCapitalize="words" />
          <View style={styles.rowActions}>
            <Button variant="outline" onPress={handleGenerateName} style={styles.flexBtn}>
              Generate new name
            </Button>
            <Button onPress={handleSaveName} disabled={savingName} style={styles.flexBtn}>
              {savingName ? 'Saving…' : 'Save'}
            </Button>
          </View>
        </View>

        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.groupTitle, { color: theme.foreground }]}>Visibility</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[styles.switchLabel, { color: theme.foreground }]}>Hide name</Text>
              <Text style={[styles.hint, { color: theme.mutedForeground }]}>
                Non-connections see your public display name instead of your real name.
              </Text>
            </View>
            <Switch value={hideName} onValueChange={handleToggleHideName} />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[styles.switchLabel, { color: theme.foreground }]}>Hide profile photo</Text>
              <Text style={[styles.hint, { color: theme.mutedForeground }]}>
                Non-connections see a generic cosmic avatar instead of your photo.
              </Text>
            </View>
            <Switch value={hideAvatar} onValueChange={handleToggleHideAvatar} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  group: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  groupTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchText: {
    flex: 1,
    gap: 4,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  flexBtn: {
    flex: 1,
  },
});
