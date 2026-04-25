import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { respondToConnectionRequest } from '@/store/actions/connectionsActions';

type ActionResult = 'accepted' | 'declined';

export default function ConnectionRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const incomingRequests = useAppSelector((state) => state.connections.incomingRequests);
  const usersMap = useAppSelector(selectAllUsersMapById);

  const request = incomingRequests.find((r) => r.id === id);
  const requester = request ? usersMap[request.fromId] : undefined;

  const remainingCount = incomingRequests.filter(
    (r) => r.status === 'pending' && r.id !== id,
  ).length;

  const handleRespond = async (accept: boolean) => {
    if (!request) return;
    setLoading(true);
    try {
      await dispatch(respondToConnectionRequest({ requestId: request.id, accept })).unwrap();
      setResult(accept ? 'accepted' : 'declined');
    } catch {
      addToast({ type: 'error', title: 'Something went wrong. Try again!' });
    } finally {
      setLoading(false);
    }
  };

  // ── Post-action view ──────────────────────────────────────────────────────

  if (result) {
    const requesterName = requester?.firstName ?? 'That person';
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={[
            styles.centeredContainer,
            { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <Text style={styles.resultEmoji}>{result === 'accepted' ? '🤝' : '👋'}</Text>
          <Text style={[styles.resultTitle, { color: theme.foreground }]}>
            {result === 'accepted' ? 'You\'re connected!' : 'Request declined'}
          </Text>
          <Text style={[styles.resultSubtitle, { color: theme.mutedForeground }]}>
            {result === 'accepted'
              ? `You and ${requesterName} can now see each other's Daily Circle.`
              : `${requesterName}'s request has been declined.`}
          </Text>

          <View style={styles.resultActions}>
            <Button onPress={() => router.push('/(protected)/my-people')} size="md">
              See My People
            </Button>
            {remainingCount > 0 && (
              <Button
                variant="outline"
                size="md"
                onPress={() => router.push('/(protected)/notifications')}
              >
                View {remainingCount} more request{remainingCount !== 1 ? 's' : ''}
              </Button>
            )}
            <Button
              variant="tertiary"
              size="md"
              onPress={() => router.push('/(protected)/feed')}
            >
              Go to Feed
            </Button>
          </View>
        </View>
      </>
    );
  }

  // ── Request not found ─────────────────────────────────────────────────────

  if (!request || request.status !== 'pending') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={[
            styles.centeredContainer,
            { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <Text style={styles.resultEmoji}>🤔</Text>
          <Text style={[styles.resultTitle, { color: theme.foreground }]}>
            Request unavailable
          </Text>
          <Text style={[styles.resultSubtitle, { color: theme.mutedForeground }]}>
            This request may have already been handled or is no longer available.
          </Text>
          <View style={styles.resultActions}>
            <Button onPress={() => router.push('/(protected)/notifications')} size="md">
              View Notifications
            </Button>
          </View>
        </View>
      </>
    );
  }

  // ── Review view ───────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background, paddingTop: insets.top },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={[styles.backButton, { paddingTop: 8 }]}
        >
          <Text style={[styles.backText, { color: theme.mutedForeground }]}>← Back</Text>
        </Pressable>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 32 },
          ]}
        >
          <Text style={[styles.pageTitle, { color: theme.foreground }]}>
            🤝 Connection Request
          </Text>

          <Card style={styles.requestCard}>
            <View style={styles.requesterRow}>
              <Avatar user={requester} size="md" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.requesterName, { color: theme.foreground }]}>
                  {requester?.firstName ?? 'Unknown'} {requester?.lastName ?? 'User'}
                </Text>
                <Text style={[styles.requestLabel, { color: theme.mutedForeground }]}>
                  wants to connect with you
                </Text>
              </View>
            </View>

            <View style={[styles.explainBox, { backgroundColor: theme.secondary }]}>
              <Text style={[styles.explainText, { color: theme.secondaryForeground }]}>
                💡 Accepting means you'll both be able to see each other's{' '}
                <Text style={{ fontWeight: '700' }}>Daily Circle</Text> — your everyday updates.
              </Text>
            </View>
          </Card>

          <View style={styles.ctaRow}>
            <Button
              variant="destructive"
              size="lg"
              style={{ flex: 1 }}
              onPress={() => handleRespond(false)}
              loading={loading}
            >
              Decline
            </Button>
            <Button
              size="lg"
              style={{ flex: 1 }}
              onPress={() => handleRespond(true)}
              loading={loading}
            >
              Accept
            </Button>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  backText: {
    fontSize: 15,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 20,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  requestCard: {
    gap: 16,
  },
  requesterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requesterName: {
    fontSize: 16,
    fontWeight: '700',
  },
  requestLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  explainBox: {
    borderRadius: 10,
    padding: 12,
  },
  explainText: {
    fontSize: 14,
    lineHeight: 20,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  // ── Post-action styles ──
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  resultEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  resultSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  resultActions: {
    width: '100%',
    gap: 12,
    marginTop: 16,
  },
});
