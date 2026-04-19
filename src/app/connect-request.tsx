import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AngeliaLogo } from '@/components/AngeliaLogo';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setPendingFromUserId } from '@/store/slices/connectionsSlice';
import { sendConnectionRequest } from '@/store/actions/connectionsActions';
import { getUserProfile, getExistingConnectionRequest } from '@/services/firebase/firestore';
import type { User } from '@/models/types';

/**
 * Public screen — accessible before sign-in.
 * Opened via deep link: angelia://connect-request?from={userId}
 *
 * Shows the host's profile and lets the visitor send a connection request.
 * If not signed in, stores the pending host ID and redirects to auth.
 */
export default function ConnectRequestScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const { firebaseUser } = useAuth();
  const { addToast } = useToast();
  const insets = useSafeAreaInsets();

  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const connections = useAppSelector((state) => state.connections.connections);

  const [hostUser, setHostUser] = useState<User | null>(null);
  const [loadingHost, setLoadingHost] = useState(true);
  const [sending, setSending] = useState(false);
  const [alreadyRequested, setAlreadyRequested] = useState(false);
  const [alreadyConnected, setAlreadyConnected] = useState(false);

  const isSignedIn = !!firebaseUser || isDemo;

  // Load the host's profile
  useEffect(() => {
    if (!from) {
      setLoadingHost(false);
      return;
    }
    setLoadingHost(true);
    getUserProfile(from)
      .then((user) => setHostUser(user))
      .catch(() => setHostUser(null))
      .finally(() => setLoadingHost(false));
  }, [from]);

  // Check if a request already exists once the current user is known
  useEffect(() => {
    if (!from || !currentUser) return;

    // Check if already connected via Redux state
    if (connections.some((c) => c.userId === from)) {
      setAlreadyConnected(true);
      return;
    }

    getExistingConnectionRequest(currentUser.id, from)
      .then((req) => {
        if (req) {
          setAlreadyRequested(true);
          setAlreadyConnected(req.status === 'accepted');
        }
      })
      .catch(() => {});
  }, [from, currentUser, connections]);

  const handleConnect = useCallback(async () => {
    if (!from) return;

    if (!isSignedIn) {
      dispatch(setPendingFromUserId(from));
      router.push({
        pathname: '/auth',
        params: { redirect: '/(protected)/feed' },
      });
      return;
    }

    if (!currentUser) return;

    // Can't connect to yourself
    if (from === currentUser.id) {
      addToast({ type: 'info', title: "That's your own link! Share it with others 😄" });
      return;
    }

    setSending(true);
    try {
      await dispatch(sendConnectionRequest({ toId: from })).unwrap();
      setAlreadyRequested(true);
      addToast({ type: 'success', title: 'Connection request sent! 🤝' });
    } catch {
      addToast({ type: 'error', title: 'Failed to send request — please try again.' });
    } finally {
      setSending(false);
    }
  }, [from, isSignedIn, currentUser, dispatch, addToast, router]);

  const hostName = hostUser
    ? `${hostUser.firstName} ${hostUser.lastName}`
    : 'Someone on Angelia';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.logoRow}>
        <AngeliaLogo size={40} />
      </View>

      {loadingHost ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 48 }} />
      ) : !from ? (
        <View style={styles.centered}>
          <Text style={[styles.emoji]}>🤔</Text>
          <Text style={[styles.heading, { color: theme.foreground }]}>Invalid link</Text>
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
            This connection link doesn't look right. Ask the person to share it again.
          </Text>
        </View>
      ) : (
        <>
          {/* Host card */}
          <View style={[styles.hostCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Avatar preset={hostUser?.avatar ?? 'moon'} uri={hostUser?.avatarUrl} size="xl" />
            <Text style={[styles.hostName, { color: theme.foreground }]}>{hostName}</Text>
            {hostUser?.funFact ? (
              <Text style={[styles.hostFact, { color: theme.mutedForeground }]}>
                "{hostUser.funFact}"
              </Text>
            ) : null}
          </View>

          {alreadyConnected ? (
            <>
              <View style={[styles.statusCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <Text style={[styles.statusText, { color: theme.foreground }]}>
                  ✅ You're already connected with {hostUser?.firstName ?? 'this person'}!
                </Text>
              </View>
              <Button onPress={() => router.replace('/(protected)/feed')} style={styles.cta}>
                Go to Feed
              </Button>
            </>
          ) : alreadyRequested ? (
            <>
              <View style={[styles.statusCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <Text style={[styles.statusText, { color: theme.foreground }]}>
                  🕐 Your connection request to {hostUser?.firstName ?? 'this person'} is pending their approval.
                </Text>
              </View>
              <Button onPress={() => router.replace('/(protected)/feed')} style={styles.cta}>
                Go to Feed
              </Button>
            </>
          ) : (
            <>
              <Text style={[styles.headline, { color: theme.foreground }]}>
                Connect with {hostUser?.firstName ?? 'this person'}?
              </Text>
              <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
                When {hostUser?.firstName ?? 'they'} approves, you'll both see each other's{' '}
                <Text style={{ fontWeight: '700', color: theme.primary }}>Daily Circle</Text>
                {' '}— their everyday updates, just for the people they trust.
              </Text>

              <Button
                onPress={handleConnect}
                loading={sending}
                size="lg"
                style={styles.cta}
              >
                {isSignedIn ? 'Send Connection Request' : 'Sign in to Connect'}
              </Button>

              {!isSignedIn && (
                <Text style={[styles.hint, { color: theme.mutedForeground }]}>
                  You'll sign in or create a free account, then your request will be sent automatically.
                </Text>
              )}

              <Button
                variant="tertiary"
                onPress={() => router.canGoBack() ? router.back() : router.replace('/auth')}
                style={{ marginTop: 8 }}
              >
                Maybe later
              </Button>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 16,
  },
  logoRow: {
    marginBottom: 8,
  },
  centered: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 40,
  },
  emoji: {
    fontSize: 52,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  hostCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
  },
  hostName: {
    fontSize: 20,
    fontWeight: '700',
  },
  hostFact: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  statusCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  cta: {
    width: '100%',
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
