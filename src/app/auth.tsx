import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, ExternalPathString } from 'expo-router';
import { AuthForm } from '@/components/ui/AuthForm';
import { AngeliaLogo } from '@/components/AngeliaLogo';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { useAppDispatch } from '@/store/hooks';
import { enterDemoMode } from '@/store/actions/demoActions';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    mode?: string;
    redirect?: string;
  }>();
  const { signIn, signUp, enterDemo, loading: authLoading, firebaseUser } = useAuth();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const [, setAuthMode] = useState<'login' | 'sign up'>(
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
          (params.redirect as ExternalPathString) || '/(protected)/feed'
        );
      }
      return {};
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed';
      return { error: { message } };
    }
  };

  const handleDemoMode = async () => {
    await enterDemo();
    dispatch(enterDemoMode());
    router.replace('/(protected)/feed');
  };

    // While auth state is resolving or resolved, render a plain background 
    // so that authenticated users never see the welcome screen flash before 
    // the redirect to the feed fires.
    if (authLoading || firebaseUser) {
      return <View style={{ flex: 1, backgroundColor: theme.background }} />;
    }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoArea}>
          <AngeliaLogo size={48} />
          <Text style={[styles.logoText, { color: theme.foreground }]}>
            Angelia
          </Text>
        </View>

        <AuthForm
          methods={['email']}
          action="both"
          onActionChange={(newMode) => setAuthMode(newMode)}
          onEmailSubmit={handleEmailSubmit}
          defaultMethod="email"
          onBack={() => router.replace('/')}
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
