import React, { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
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

  const checkVerification = useCallback(async () => {
    if (!firebaseUser) return;
    await firebaseUser.reload();
    if (firebaseUser.emailVerified) {
      const user = currentUserRef.current;
      if (user && !user.accountProgress.emailVerified) {
        await dispatch(
          updateAccountProgress({ uid: firebaseUser.uid, field: 'emailVerified', value: true })
        );
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
        . Click the link to verify your account.
      </Text>

      <Callout variant="info" style={{ marginTop: 16, marginBottom: 16 }}
        description="This page automatically checks for verification every few seconds."
      />

      <Button variant="outline" onPress={handleResend}>
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
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
