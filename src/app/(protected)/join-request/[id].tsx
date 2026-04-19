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
import { respondToJoinRequest } from '@/store/actions/inviteActions';

type ActionResult = 'accepted' | 'declined';

export default function JoinRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const channels = useAppSelector((state) => state.channels.items);
  const incoming = useAppSelector((state) => state.invites.incoming);
  const usersMap = useAppSelector(selectAllUsersMapById);

  const request = incoming.find((r) => r.id === id);
  const requester = request ? usersMap[request.requesterId] : undefined;
  const channel = request ? channels.find((c) => c.id === request.channelId) : undefined;

  // More pending requests after this one (excluding current)
  const remainingCount = incoming.filter(
    (r) => r.status === 'pending' && r.id !== id,
  ).length;

  const handleRespond = async (accept: boolean) => {
    if (!request) return;
    setLoading(true);
    try {
      await dispatch(respondToJoinRequest({ request, accept })).unwrap();
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
          <Text style={styles.resultEmoji}>{result === 'accepted' ? '🎉' : '👋'}</Text>
          <Text style={[styles.resultTitle, { color: theme.foreground }]}>
            {result === 'accepted' ? 'Request accepted!' : 'Request declined'}
          </Text>
          <Text style={[styles.resultSubtitle, { color: theme.mutedForeground }]}>
            {result === 'accepted'
              ? `${requesterName} is now a member of ${channel?.name ?? 'your channel'}.`
              : `${requesterName}'s request has been declined.`}
          </Text>

          <View style={styles.resultActions}>
            <Button onPress={() => router.push('/(protected)/feed')} size="md">
              Go to Feed
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
        {/* Back button */}
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
            📬 Join Request
          </Text>

          <Card style={styles.requestCard}>
            <View style={styles.requesterRow}>
              <Avatar preset={requester?.avatar ?? 'moon'} size="md" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.requesterName, { color: theme.foreground }]}>
                  {requester?.firstName ?? 'Unknown'} {requester?.lastName ?? 'User'}
                </Text>
                <Text style={[styles.requestLabel, { color: theme.mutedForeground }]}>
                  wants to join{' '}
                  <Text style={[styles.channelName, { color: theme.foreground }]}>
                    {channel?.name ?? 'your channel'}
                  </Text>
                </Text>
              </View>
            </View>

            {request.message ? (
              <View style={[styles.messageBox, { backgroundColor: theme.secondary }]}>
                <Text style={[styles.messageText, { color: theme.secondaryForeground }]}>
                  "{request.message}"
                </Text>
              </View>
            ) : null}
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
  channelName: {
    fontWeight: '600',
  },
  messageBox: {
    borderRadius: 8,
    padding: 12,
  },
  messageText: {
    fontSize: 14,
    fontStyle: 'italic',
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
