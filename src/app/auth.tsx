import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AuthForm } from '@/components/ui/AuthForm';
import { Button } from '@/components/ui/Button';
import { AngeliaLogo } from '@/components/AngeliaLogo';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { useAppDispatch } from '@/store/hooks';
import { enterDemoMode } from '@/store/slices/demoSlice';
import { loadDemoPosts } from '@/store/slices/postsSlice';
import { loadDemoChannels } from '@/store/slices/channelsSlice';
import { loadDemoUsers } from '@/store/slices/usersSlice';
import { loadDemoInvites } from '@/store/slices/invitesSlice';
import { DEMO_DATA } from '@/lib/demoData';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';
import { getUserProfile } from '@/services/firebase/firestore';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    redirect?: string;
  }>();
  const { signIn, signUp, signInWithGoogle, enterDemo } = useAuth();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const [authMode, setAuthMode] = useState<'login' | 'sign up'>(
    params.mode === 'signup' ? 'sign up' : 'login'
  );

  const handleEmailSubmit = async ({
    data,
    action,
  }: {
    data: { email: string; password: string };
    action: 'login' | 'signup';
  }): Promise<{ error?: { message: string } }> => {
    try {
      if (action === 'signup') {
        await signUp(data.email, data.password);
        addToast({ type: 'success', title: 'Account created!' });
        router.replace('/complete-profile');
      } else {
        await signIn(data.email, data.password);
        addToast({ type: 'success', title: 'Welcome back!' });
        router.replace(
          (params.redirect as `/${string}`) || '/(protected)/feed'
        );
      }
      return {};
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed';
      return { error: { message } };
    }
  };

  const handleGoogleSignIn = async (): Promise<{ error?: { message: string } }> => {
    try {
      const user = await signInWithGoogle();
      const profile = await getUserProfile(user.uid);
      if (profile) {
        addToast({ type: 'success', title: 'Welcome back!' });
        router.replace('/(protected)/feed');
      } else {
        addToast({ type: 'success', title: 'Signed in with Google!' });
        router.replace('/complete-profile');
      }
      return {};
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Google sign-in failed';
      return { error: { message } };
    }
  };

  const handleDemoMode = async () => {
    await enterDemo();
    dispatch(enterDemoMode());
    dispatch(loadDemoUsers(DEMO_DATA.users));
    dispatch(loadDemoChannels(DEMO_DATA.channels));
    dispatch(loadDemoPosts(DEMO_DATA.posts));
    dispatch(loadDemoInvites(DEMO_DATA.invites));
    router.replace('/(protected)/feed');
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
        <View style={styles.logoArea}>
          <AngeliaLogo size={48} />
          <Text style={[styles.logoText, { color: theme.foreground }]}>
            Angelia
          </Text>
        </View>

        <AuthForm
          methods={['google', 'email']}
          action="both"
          onActionChange={(newMode) => setAuthMode(newMode)}
          onEmailSubmit={handleEmailSubmit}
          onGoogleSignIn={handleGoogleSignIn}
        />

        <View style={styles.demoArea}>
          <Text style={[styles.demoText, { color: theme.mutedForeground }]}>
            Just looking around?
          </Text>
          <Button variant="link" onPress={handleDemoMode}>
            Try Demo Mode
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingTop: 40,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
  },
  demoArea: {
    alignItems: 'center',
    marginTop: 32,
    gap: 4,
  },
  demoText: {
    fontSize: 14,
  },
});
