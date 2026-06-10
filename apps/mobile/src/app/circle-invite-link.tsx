import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AngeliaLogo } from '@/components/AngeliaLogo';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { CircleInviteErrorModal } from '@/components/invite/CircleInviteErrorModal';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import {
  getPublicChannelInvitePreview,
  getPublicUserProfile,
  getChannel,
} from '@/services/firebase/firestore';
import { setPendingInviteChannel } from '@/store/slices/pendingInviteSlice';
import { sendJoinRequest } from '@/store/actions/inviteActions';
import { makeSelectMostRecentOutgoingRequestForChannel } from '@/store/crossSelectors/inviteSelectors';
import { channelFromPublicInvitePreview } from '@/lib/channel/channelInvite.utils';
import { getColorPair } from '@/lib/channel/channel.utils';
import type { PublicChannelInvitePreview, User } from '@/models/types';

/** Public screen — accessible before sign-in. */
export default function CircleInviteLinkScreen() {
  const { channelId, inviteCode } = useLocalSearchParams<{
    channelId?: string;
    inviteCode?: string;
  }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const { firebaseUser } = useAuth();
  const { addToast } = useToast();
  const insets = useSafeAreaInsets();

  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUser = useAppSelector((state) => state.users.currentUser);

  const [preview, setPreview] = useState<PublicChannelInvitePreview | null>(null);
  const [hostUser, setHostUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [message, setMessage] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const normalizedCode = (inviteCode ?? '').trim().toUpperCase();
  const isAuthenticated = !!firebaseUser || isDemo;
  const viewerUserId = currentUser?.id ?? firebaseUser?.uid ?? null;

  const selectMostRecentRequest = useMemo(
    () => makeSelectMostRecentOutgoingRequestForChannel(preview?.channelId ?? channelId ?? ''),
    [preview?.channelId, channelId],
  );
  const mostRecentRequest = useAppSelector(selectMostRecentRequest);

  const loadInvite = useCallback(async () => {
    if (!normalizedCode || normalizedCode.length < 8) {
      setPreview(null);
      setLoading(false);
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      let found = await getPublicChannelInvitePreview(normalizedCode);

      if (!found && channelId && isAuthenticated) {
        const channel = await getChannel(channelId);
        if (
          channel &&
          channel.markedForDeletionAt == null &&
          channel.inviteCode?.toUpperCase() === normalizedCode
        ) {
          found = {
            channelId: channel.id,
            inviteCode: channel.inviteCode.toUpperCase(),
            name: channel.name,
            description: channel.description,
            subscriberCount: channel.subscribers.length,
            ownerId: channel.ownerId,
            markedForDeletionAt: null,
          };
        }
      }

      if (!found || (channelId && found.channelId !== channelId)) {
        setPreview(null);
        setShowErrorModal(true);
        return;
      }

      setPreview(found);
      setHostUser(await getPublicUserProfile(found.ownerId));

      if (isAuthenticated && viewerUserId) {
        const fullChannel = await getChannel(found.channelId);
        setIsSubscribed(fullChannel?.subscribers.includes(viewerUserId) ?? false);
      } else {
        setIsSubscribed(false);
      }
    } catch {
      setPreview(null);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  }, [normalizedCode, channelId, isAuthenticated, viewerUserId]);

  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  const channel = preview ? channelFromPublicInvitePreview(preview) : null;
  const colors = channel ? getColorPair(channel) : { backgroundColor: '#6366F1', textColor: '#FFF' };
  const isOwnCircle = preview != null && preview.ownerId === viewerUserId;
  const existingRequest =
    mostRecentRequest?.status === 'accepted' && !isSubscribed
      ? undefined
      : mostRecentRequest;

  const handleSignIn = useCallback(() => {
    if (!preview) return;
    dispatch(setPendingInviteChannel(channelFromPublicInvitePreview(preview)));
    router.push({ pathname: '/auth', params: { mode: 'login', redirect: '/(protected)/feed' } });
  }, [preview, dispatch, router]);

  const handleSignUp = useCallback(() => {
    if (!preview) return;
    dispatch(setPendingInviteChannel(channelFromPublicInvitePreview(preview)));
    router.push({ pathname: '/auth', params: { mode: 'signup', redirect: '/(protected)/feed' } });
  }, [preview, dispatch, router]);

  const handleJoinRequest = useCallback(async () => {
    if (!preview || !channel) return;

    if (!isAuthenticated) {
      dispatch(setPendingInviteChannel(channel));
      router.push({ pathname: '/auth', params: { redirect: '/(protected)/feed' } });
      return;
    }

    if (!currentUser) return;
    if (preview.ownerId === currentUser.id) {
      addToast({ type: 'error', title: 'You are the Host of this Circle already.' });
      return;
    }

    setJoinLoading(true);
    try {
      await dispatch(
        sendJoinRequest({
          channelId: preview.channelId,
          inviteCode: preview.inviteCode,
          channelOwnerId: preview.ownerId,
          message: message.trim(),
        }),
      ).unwrap();
      addToast({ type: 'success', title: 'Join request sent!' });
      router.replace('/(protected)/feed');
    } catch (err) {
      addToast({
        type: 'error',
        title: err instanceof Error ? err.message : 'Failed to send join request',
      });
    } finally {
      setJoinLoading(false);
    }
  }, [preview, channel, isAuthenticated, currentUser, dispatch, router, message, addToast]);

  const hostName = hostUser
    ? `${hostUser.firstName} ${hostUser.lastName}`
    : 'Someone on Angelia';

  return (
    <>
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

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 48 }} />
        ) : preview && channel ? (
          <>
            <Text style={[styles.headline, { color: theme.foreground }]}>
              Join {preview.name}?
            </Text>
            <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
              You've been invited to request access to this Circle.
            </Text>

            <Card style={styles.channelCard}>
              <View style={styles.channelInfo}>
                <Badge
                  style={{
                    backgroundColor: colors.backgroundColor,
                    borderColor: colors.backgroundColor,
                  }}
                  textStyle={{
                    color: colors.textColor,
                    fontSize: 16,
                    fontWeight: '600',
                    textAlign: 'center',
                  }}
                >
                  {preview.name}
                </Badge>
                {preview.description ? (
                  <Text style={[styles.description, { color: theme.mutedForeground }]}>
                    {preview.description}
                  </Text>
                ) : null}
                <View style={styles.ownerRow}>
                  <Avatar user={hostUser} size="sm" showStatus={false} />
                  <Text style={[styles.ownerName, { color: theme.mutedForeground }]}>
                    Hosted by {hostName}
                  </Text>
                </View>
                <Text style={[styles.meta, { color: theme.mutedForeground }]}>
                  {preview.subscriberCount} member
                  {preview.subscriberCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </Card>

            {isOwnCircle ? (
              <Text style={[styles.statusText, { color: theme.mutedForeground }]}>
                You're the Host of this Circle.
              </Text>
            ) : isSubscribed ? (
              <Text style={[styles.statusText, { color: theme.success }]}>
                You're already a member of this circle!
              </Text>
            ) : existingRequest ? (
              <Text style={[styles.statusText, { color: theme.mutedForeground }]}>
                {existingRequest.status === 'pending'
                  ? 'Your join request is pending approval.'
                  : existingRequest.status === 'accepted'
                    ? 'Your request was accepted!'
                    : 'Your join request was declined.'}
              </Text>
            ) : isAuthenticated ? (
              <>
                <Text style={[styles.label, { color: theme.foreground }]}>
                  Introduce yourself (optional)
                </Text>
                <Textarea
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Hi! I'm..."
                  maxLength={300}
                  rows={3}
                />
                <Button onPress={handleJoinRequest} loading={joinLoading} size="lg" style={styles.cta}>
                  Request to Join
                </Button>
              </>
            ) : (
              <>
                <View style={styles.authButtonRow}>
                  <Button onPress={handleSignIn} variant="outline" size="lg" style={styles.authButton}>
                    Sign In
                  </Button>
                  <Button onPress={handleSignUp} size="lg" style={styles.authButton}>
                    Sign Up
                  </Button>
                </View>
                <Text style={[styles.hint, { color: theme.mutedForeground }]}>
                  Sign in to request to join — we'll remember this invite.
                </Text>
              </>
            )}

            <Button
              variant="tertiary"
              onPress={() => router.replace(isAuthenticated ? '/(protected)/feed' : '/auth')}
              style={{ marginTop: 12 }}
            >
              {isAuthenticated ? 'Go to Feed' : 'Back'}
            </Button>
          </>
        ) : null}
      </ScrollView>

      <CircleInviteErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        onGoToFeed={() => {
          if (isAuthenticated) {
            router.replace('/(protected)/feed');
          } else {
            router.replace('/auth');
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, gap: 16 },
  logoRow: { alignItems: 'center', marginBottom: 8 },
  headline: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  channelCard: { marginTop: 8 },
  channelInfo: { alignItems: 'center', gap: 10 },
  description: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  ownerName: { fontSize: 14 },
  meta: { fontSize: 13 },
  label: { fontSize: 14, fontWeight: '600' },
  cta: { marginTop: 8 },
  authButtonRow: { flexDirection: 'row', gap: 12 },
  authButton: { flex: 1 },
  hint: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  statusText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
