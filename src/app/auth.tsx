import React, { useEffect, useRef, useState } from 'react';
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
import { Loading } from '@/components/Loading';

/** Maps Firebase Auth error codes to friendly, consumer-readable messages. */
function getFirebaseAuthErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code ?? '';
    switch (code) {
      case 'auth/invalid-email':
        return "Hmm, that email doesn't look quite right. Mind double-checking?";
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        // Intentionally identical — don't reveal whether the email or password was wrong.
        return 'Incorrect email or password. Please try again.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'Connection issue. Check your internet and try again.';
      case 'auth/email-already-in-use':
        return 'That email is already registered. Try signing in instead!';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger one.';
      case 'auth/operation-not-allowed':
        return 'Sign-in is not enabled for this method. Please contact support.';
      case 'auth/requires-recent-login':
        return 'Please sign in again to continue.';
      case 'auth/account-exists-with-different-credential':
        return 'An account with this email already exists. Try a different sign-in method.';
      default:
        return err.message || 'Authentication failed. Please try again.';
    }
  }
  return 'Authentication failed. Please try again.';
}

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    mode?: string;
    redirect?: string;
  }>();
  const { signIn, signUp, enterDemo, loading: authLoading, firebaseUser, sendPasswordReset } = useAuth();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const signUpInProgress = useRef(false);
  const [, setAuthMode] = useState<'login' | 'sign up'>(
    params.mode === 'signup' ? 'sign up' : 'login'
  );

  // The destination to navigate to after a successful sign-in.
  // Captured once so param changes mid-render don't affect in-flight sign-ins.
  const redirectDest = useRef<string>(
    (params.redirect as string) || '/(protected)/feed'
  );

  // Navigate to the feed (or redirect param) once Firebase confirms the user
  // is signed in and the profile is loaded.  We do this in a useEffect rather
  // than calling router.replace() immediately inside handleEmailSubmit because
  // signInWithEmailAndPassword() resolves before onAuthStateChanged() has
  // finished fetching the profile — meaning the protected layout would see
  // firebaseUser=null and bounce back to /auth.  Waiting for firebaseUser to
  // become non-null guarantees the protected layout will let us through.
  useEffect(() => {
    if (signUpInProgress.current || !firebaseUser || authLoading) return;
    router.replace(redirectDest.current as ExternalPathString);
  }, [firebaseUser, authLoading, router]);

  const handleEmailSubmit = async ({
    data,
    action,
  }: {
    data: { email: string; password: string };
    action: 'login' | 'signup';
  }): Promise<{ error?: { message: string } }> => {
    try {
      if (action === 'signup') {
        signUpInProgress.current = true;
        await signUp(data.email, data.password);
        router.replace('/complete-profile');
      } else {
        await signIn(data.email, data.password);
        addToast({ type: 'success', title: 'Welcome back!' });
        // Navigation is handled by the firebaseUser useEffect above.
      }
      return {};
    } catch (err: unknown) {
      const message = getFirebaseAuthErrorMessage(err);
      return { error: { message } };
    }
  };

  const handleForgotPassword = async (email: string) => {
    await sendPasswordReset(email);
  };

  const handleDemoMode = async () => {
    await enterDemo();
    dispatch(enterDemoMode());
    router.replace('/(protected)/feed');
  };

    // While auth state is resolving or resolved, render a plain background 
    // so that authenticated users never see the welcome screen flash before 
    // the redirect to the feed fires.
    if (!signUpInProgress.current && (authLoading || firebaseUser)) {
      return <Loading />;
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
          onForgotPassword={handleForgotPassword}
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
