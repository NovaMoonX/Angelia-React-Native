import React, { useEffect, useRef, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { updateAccountProgress } from '@/store/actions/userActions';
import { ensureDailyChannelExists } from '@/store/actions/channelActions';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { firebaseUser, sendVerificationEmail } = useAuth();
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);

  const checkVerification = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      await firebaseUser.reload();
    } catch {
      // Reload failure is non-fatal; rely on the cached value
    }
    // Use getAuth().currentUser to get the freshest emailVerified value after reload.
    // Fall back to false (not verified) if no current user is found.
    const verified = getAuth().currentUser?.emailVerified ?? false;
    if (verified) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      const user = currentUserRef.current;
      try {
        if (user && !user.accountProgress.emailVerified) {
          await dispatch(
            updateAccountProgress({ uid: firebaseUser.uid, field: 'emailVerified', value: true })
          ).unwrap();
        }
      } catch {
        // Best-effort progress sync; continue to feed
      }
      if (user?.accountProgress.signUpComplete) {
        dispatch(ensureDailyChannelExists(firebaseUser.uid));
      }
      router.replace('/(protected)/feed');
    }
  }, [firebaseUser, router, dispatch]);

  useEffect(() => {
    intervalRef.current = setInterval(checkVerification, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkVerification]);

  const handleResend = async () => {
    await sendVerificationEmail();
  };

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      await checkVerification();
    } finally {
      setChecking(false);
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}
    >
      <Text style={styles.emoji}>📧</Text>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        Verify Your Email
      </Text>
      <Text style={[styles.description, { color: theme.mutedForeground }]}>
        We sent a verification link to{' '}
        <Text style={{ fontWeight: '600' }}>
          {firebaseUser?.email || 'your email'}
        </Text>
        . Click the link to verify your account. You may need to check your spam folder.
      </Text>

      <Button onPress={handleManualCheck} loading={checking} style={styles.button}>
        I did ✓
      </Button>

      <Button variant="outline" onPress={handleResend} style={styles.button}>
        Resend Verification Email
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 4,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  button: {
    width: '100%',
  },
});
