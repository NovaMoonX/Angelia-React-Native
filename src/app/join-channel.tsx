import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AngeliaLogo } from '@/components/AngeliaLogo';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CodeInput } from '@/components/ui/CodeInput';
import { Textarea } from '@/components/ui/Textarea';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { getChannelByInviteCode } from '@/services/firebase/firestore';
import { setPendingInviteChannel, clearPendingInvite } from '@/store/slices/pendingInviteSlice';
import { sendJoinRequest } from '@/store/actions/inviteActions';
import { getColorPair } from '@/lib/channel/channel.utils';
import type { Channel } from '@/models/types';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';

type Step = 'enter-code' | 'confirm-channel';

export default function JoinChannelScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const { firebaseUser } = useAuth();
  const { addToast } = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code?: string }>();

  const currentUser = useAppSelector((state) => state.users.currentUser);
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const outgoing = useAppSelector((state) => state.invites.outgoing);

  const [step, setStep] = useState<Step>('enter-code');
  const [code, setCode] = useState(params.code?.toUpperCase() || '');
  const [channel, setChannel] = useState<Channel | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [message, setMessage] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const isAuthenticated = !!firebaseUser || isDemo;

  const handleLookup = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 8) {
      setLookupError('Please enter the full 8-character code.');
      return;
    }
    setLookupError('');
    setLookupLoading(true);
    try {
      const found = await getChannelByInviteCode(trimmed);
      if (!found) {
        setLookupError('No channel found with this code. Double-check and try again!');
        setLookupLoading(false);
        return;
      }
      setChannel(found);
      setStep('confirm-channel');
    } catch {
      setLookupError('Something went wrong. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  }, [code]);

  const handleJoinRequest = useCallback(async () => {
    if (!channel) return;

    // If user is not authenticated, store pending invite and redirect to auth
    if (!isAuthenticated) {
      dispatch(setPendingInviteChannel(channel));
      router.push({
        pathname: '/auth',
        params: { redirect: '/(protected)/feed' },
      });
      return;
    }

    if (!currentUser) return;

    setJoinLoading(true);
    try {
      await dispatch(
        sendJoinRequest({
          channelId: channel.id,
          inviteCode: channel.inviteCode || '',
          channelOwnerId: channel.ownerId,
          message: message.trim(),
        }),
      ).unwrap();
      dispatch(clearPendingInvite());
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
  }, [channel, isAuthenticated, currentUser, dispatch, message, addToast, router]);

  const handleBack = useCallback(() => {
    if (step === 'confirm-channel') {
      setStep('enter-code');
      setChannel(null);
      return;
    }
    router.back();
  }, [step, router]);

  const isSubscribed = channel?.subscribers.includes(currentUser?.id || '') || false;
  const existingRequest = channel
    ? outgoing.find((r) => r.channelId === channel.id)
    : undefined;

  const colors = channel
    ? getColorPair(channel)
    : { backgroundColor: '#6366F1', textColor: '#FFF' };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Pressable onPress={handleBack} style={styles.backRow}>
          <Feather name="arrow-left" size={20} color={theme.primary} />
          <Text style={[styles.backText, { color: theme.primary }]}>
            Back
          </Text>
        </Pressable>

        {step === 'enter-code' && (
          <View style={styles.enterCodeContainer}>
            <View style={styles.logoRow}>
              <AngeliaLogo size={48} />
            </View>

            <Text style={[styles.heading, { color: theme.foreground }]}>
              Join a Channel
            </Text>
            <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
              Enter the 8-character invite code shared with you to find the channel.
            </Text>

            <View style={styles.codeSection}>
              <CodeInput
                length={8}
                value={code}
                onChange={(val) => {
                  setCode(val);
                  setLookupError('');
                }}
                autoFocus
              />
              {lookupError ? (
                <Text style={styles.errorText}>{lookupError}</Text>
              ) : null}
            </View>

            <Button
              onPress={handleLookup}
              loading={lookupLoading}
              disabled={lookupLoading || code.length < 8}
              size="lg"
              style={styles.findButton}
            >
              Find Channel
            </Button>
          </View>
        )}

        {step === 'confirm-channel' && channel && (
          <View style={styles.confirmContainer}>
            <Text style={[styles.heading, { color: theme.foreground }]}>
              Does this look right?
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
                  }}
                >
                  {channel.name}
                </Badge>
                {channel.description ? (
                  <Text style={[styles.description, { color: theme.mutedForeground }]}>
                    {channel.description}
                  </Text>
                ) : null}
                <Text style={[styles.meta, { color: theme.mutedForeground }]}>
                  {channel.subscribers.length} subscriber
                  {channel.subscribers.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </Card>

            {isAuthenticated && isSubscribed ? (
              <View style={styles.statusSection}>
                <Feather name="check-circle" size={20} color={theme.success} />
                <Text style={[styles.statusText, { color: theme.success }]}>
                  You're already subscribed to this channel!
                </Text>
              </View>
            ) : isAuthenticated && existingRequest ? (
              <View style={styles.statusSection}>
                <Feather
                  name={existingRequest.status === 'accepted' ? 'check-circle' : 'clock'}
                  size={20}
                  color={existingRequest.status === 'accepted' ? theme.success : theme.warning}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        existingRequest.status === 'accepted'
                          ? theme.success
                          : existingRequest.status === 'declined'
                            ? theme.destructive
                            : theme.warning,
                    },
                  ]}
                >
                  {existingRequest.status === 'pending'
                    ? 'Your join request is pending approval.'
                    : existingRequest.status === 'accepted'
                      ? 'Your request was accepted!'
                      : 'Your join request was declined.'}
                </Text>
              </View>
            ) : (
              <View style={styles.joinSection}>
                {isAuthenticated && (
                  <View style={styles.messageField}>
                    <Text style={[styles.label, { color: theme.foreground }]}>
                      Introduce yourself (optional)
                    </Text>
                    <Textarea
                      value={message}
                      onChangeText={setMessage}
                      placeholder="Hi! I'd love to join…"
                      maxLength={300}
                      rows={3}
                    />
                  </View>
                )}

                <Button
                  onPress={handleJoinRequest}
                  loading={joinLoading}
                  size="lg"
                  style={styles.joinButton}
                >
                  {isAuthenticated ? 'Request to Join' : 'Sign in to Join'}
                </Button>

                {!isAuthenticated && (
                  <Text style={[styles.hint, { color: theme.mutedForeground }]}>
                    You'll create an account or sign in, then be added to this channel.
                  </Text>
                )}
              </View>
            )}

            <Button
              variant="tertiary"
              onPress={() => {
                setStep('enter-code');
                setChannel(null);
              }}
              style={{ marginTop: 8 }}
            >
              Try a different code
            </Button>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  enterCodeContainer: {
    alignItems: 'center',
    gap: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  codeSection: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
  },
  findButton: {
    width: '100%',
    marginTop: 12,
  },
  confirmContainer: {
    gap: 16,
    alignItems: 'center',
  },
  channelCard: {
    width: '100%',
    padding: 20,
  },
  channelInfo: {
    alignItems: 'center',
    gap: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  meta: {
    fontSize: 13,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  joinSection: {
    width: '100%',
    gap: 12,
  },
  messageField: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  joinButton: {
    width: '100%',
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
