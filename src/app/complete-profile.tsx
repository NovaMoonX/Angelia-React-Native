import React, { useState } from 'react';
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
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { AVATAR_PRESETS } from '@/models/constants';
import type { AvatarPreset } from '@/models/types';
import {
  createUserProfile,
  createDailyChannel,
} from '@/services/firebase/firestore';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { firebaseUser, sendVerificationEmail } = useAuth();
  const { addToast } = useToast();
  const { theme } = useTheme();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [funFact, setFunFact] = useState('');
  const [avatar, setAvatar] = useState<AvatarPreset>('moon');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      addToast({ type: 'warning', title: 'Please fill in your name' });
      return;
    }
    if (!firebaseUser) return;

    setLoading(true);
    try {
      await createUserProfile({
        id: firebaseUser.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: firebaseUser.email || '',
        funFact: funFact.trim(),
        avatar,
      });

      await createDailyChannel(firebaseUser.uid);
      await sendVerificationEmail();

      addToast({ type: 'success', title: 'Profile created!' });
      router.replace('/verify-email');
    } catch (err) {
      addToast({
        type: 'error',
        title:
          err instanceof Error
            ? err.message
            : 'Failed to create profile',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={[styles.heading, { color: theme.foreground }]}>
        Welcome! Let's set up your profile.
      </Text>

      {/* Avatar Picker */}
      <View style={styles.section}>
        <Label>Choose Your Avatar</Label>
        <View style={styles.avatarCurrent}>
          <Avatar preset={avatar} size="xl" />
        </View>
        <View style={styles.avatarGrid}>
          {AVATAR_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              onPress={() => setAvatar(preset)}
              style={[
                styles.avatarOption,
                avatar === preset && {
                  borderColor: theme.primary,
                  borderWidth: 2,
                },
              ]}
            >
              <Avatar preset={preset} size="md" />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Name Fields */}
      <View style={styles.section}>
        <Label>First Name *</Label>
        <Input
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.section}>
        <Label>Last Name *</Label>
        <Input
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.section}>
        <Label>Fun Fact (optional)</Label>
        <Textarea
          value={funFact}
          onChangeText={setFunFact}
          placeholder="Tell us something fun about you!"
          maxLength={200}
        />
      </View>

      <Button
        onPress={handleSubmit}
        loading={loading}
        style={{ marginTop: 16 }}
      >
        Create Profile
      </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    gap: 8,
  },
  avatarCurrent: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  avatarOption: {
    borderRadius: 24,
    padding: 4,
  },
});
