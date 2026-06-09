import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { respondToCircleInviteRequest } from '@/store/actions/inviteActions';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { navigateBackFromEntry } from '@/lib/navigation/entryNavigation.utils';
import { getCircleInviteRequest } from '@/services/firebase/firestore';
import type { CircleInviteRequest } from '@/models/types';

export default function CircleInviteScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'accepted' | 'declined' | null>(null);
  const [resolvedRequest, setResolvedRequest] = useState<CircleInviteRequest | null>(null);

  const channels = useAppSelector((state) => state.channels.items);
  const incoming = useAppSelector((state) => state.invites.incomingCircleInvites);
  const usersMap = useAppSelector(selectAllUsersMapById);

  const request = resolvedRequest ?? incoming.find((r) => r.id === id) ?? null;
  const inviter = request ? usersMap[request.inviterId] : undefined;
  const channel = request ? channels.find((c) => c.id === request.channelId) : undefined;

  useEffect(() => {
    if (!id || request) return;
    void getCircleInviteRequest(id)
      .then((found) => {
        setResolvedRequest(found);
      })
      .catch(() => {
        setResolvedRequest(null);
      });
  }, [id, request]);

  const handleRespond = async (accept: boolean) => {
    if (!request) return;
    setLoading(true);
    try {
      await dispatch(respondToCircleInviteRequest({ request, accept })).unwrap();
      setResult(accept ? 'accepted' : 'declined');
    } catch {
      addToast({ type: 'error', title: 'Something went wrong. Try again!' });
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <>
        <ScreenHeader title="Circle Invite" onBack={() => navigateBackFromEntry(from)} />
        <View
          style={[
            styles.centeredContainer,
            { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <Text style={styles.resultEmoji}>{result === 'accepted' ? '🎉' : '👋'}</Text>
          <Text style={[styles.resultTitle, { color: theme.foreground }]}> 
            {result === 'accepted' ? 'You’re in!' : 'Invite declined'}
          </Text>
          <Text style={[styles.resultSubtitle, { color: theme.mutedForeground }]}> 
            {result === 'accepted'
              ? `You’ve been added to ${channel?.name ?? 'the Circle'}.`
              : `This invite has been declined.`}
          </Text>
          <View style={styles.resultActions}>
            <Button onPress={() => router.push('/(protected)/feed')} size="md">
              Go to Feed
            </Button>
            <Button variant="outline" size="md" onPress={() => router.push('/(protected)/notifications')}>
              View Notifications
            </Button>
          </View>
        </View>
      </>
    );
  }

  if (!request || request.status !== 'pending') {
    return (
      <>
        <ScreenHeader title="Circle Invite" onBack={() => navigateBackFromEntry(from)} />
        <View
          style={[
            styles.centeredContainer,
            { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <Text style={styles.resultEmoji}>🤔</Text>
          <Text style={[styles.resultTitle, { color: theme.foreground }]}>Invite unavailable</Text>
          <Text style={[styles.resultSubtitle, { color: theme.mutedForeground }]}> 
            This invite may have already been handled or is no longer available.
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

  return (
    <>
      <ScreenHeader title="Circle Invite" onBack={() => navigateBackFromEntry(from)} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        <Text style={[styles.pageTitle, { color: theme.foreground }]}>✨ Circle Invite</Text>

        <Card style={styles.requestCard}>
          <View style={styles.requesterRow}>
            <Avatar user={inviter} size="md" showStatus={false} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.requesterName, { color: theme.foreground }]}> 
                {inviter?.firstName ?? 'Someone'} {inviter?.lastName ?? 'special'}
              </Text>
              <Text style={[styles.requestLabel, { color: theme.mutedForeground }]}> 
                invited you to join{' '}
                <Text style={[styles.channelName, { color: theme.foreground }]}> 
                  {channel?.name ?? 'their Circle'}
                </Text>
              </Text>
            </View>
          </View>

          {channel?.description ? (
            <View style={[styles.messageBox, { backgroundColor: theme.secondary }]}> 
              <Text style={[styles.messageText, { color: theme.secondaryForeground }]}> 
                {channel.description}
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
    </>
  );
}

const styles = StyleSheet.create({
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
    lineHeight: 20,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
  },
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
