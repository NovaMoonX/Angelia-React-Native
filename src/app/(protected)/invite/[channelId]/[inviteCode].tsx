import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { getColorPair } from '@/lib/channel/channel.utils';
import { selectChannelById } from '@/store/slices/channelsSlice';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { sendJoinRequest } from '@/store/actions/inviteActions';

export default function InviteAcceptScreen() {
  const { channelId, inviteCode } = useLocalSearchParams<{
    channelId: string;
    inviteCode: string;
  }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const channel = useAppSelector((state) =>
    selectChannelById(state, channelId || '')
  );
  const usersMap = useAppSelector(selectAllUsersMapById);
  const outgoing = useAppSelector((state) => state.invites.outgoing);

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const owner = channel ? usersMap[channel.ownerId] : undefined;
  const colors = channel
    ? getColorPair(channel)
    : { backgroundColor: '#6366F1', textColor: '#FFF' };

  // Check existing relationship
  const isSubscribed =
    channel?.subscribers.includes(currentUser?.id || '') || false;
  const existingRequest = outgoing.find(
    (r) => r.channelId === channelId
  );
  const isInvalidCode =
    channel && channel.inviteCode !== inviteCode;

  const handleJoinRequest = async () => {
    if (!currentUser || !channelId || !inviteCode) return;
    setLoading(true);
    try {
      await dispatch(
        sendJoinRequest({
          channelId,
          inviteCode,
          channelOwnerId: channel?.ownerId || '',
          message: message.trim(),
        })
      ).unwrap();
      addToast({ type: 'success', title: 'Join request sent!' });
      router.replace('/(protected)/feed');
    } catch (err) {
      addToast({
        type: 'error',
        title:
          err instanceof Error ? err.message : 'Failed to send request',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!channel) {
    return (
      <View style={[
        styles.centered,
        {
          backgroundColor: theme.background,
          paddingTop: isDemo ? 12 : insets.top + 8,
          paddingHorizontal: 20
        }
      ]}>
        <Callout variant="destructive"
          description="This invite link is invalid or the channel no longer exists."
        />
        <Button
          variant="outline"
          onPress={() => router.replace('/(protected)/feed')}
          style={{ marginTop: 16 }}
        >
          Go to Feed
        </Button>
      </View>
    );
  }

  if (isInvalidCode) {
    return (
      <View style={[
        styles.centered,
        {
          backgroundColor: theme.background,
          paddingTop: isDemo ? 12 : insets.top + 8,
          paddingHorizontal: 20
        }
      ]}>
        <Callout variant="destructive"
          description="This invite code has expired or is invalid."
        />
        <Button
          variant="outline"
          onPress={() => router.replace('/(protected)/feed')}
          style={{ marginTop: 16 }}
        >
          Go to Feed
        </Button>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: isDemo ? 12 : insets.top + 8,
          paddingHorizontal: 20
        }
      ]}
    >
      <Card style={styles.card}>
        <Text style={[styles.heading, { color: theme.foreground }]}>
          You've been invited to join
        </Text>

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
            <Text
              style={[
                styles.description,
                { color: theme.mutedForeground },
              ]}
            >
              {channel.description}
            </Text>
          ) : null}
          {owner && (
            <View style={styles.ownerRow}>
              <Avatar preset={owner.avatar} size="sm" />
              <Text
                style={[styles.ownerName, { color: theme.mutedForeground }]}
              >
                Owned by {owner.firstName} {owner.lastName}
              </Text>
            </View>
          )}
        </View>

        {isSubscribed ? (
          <Callout variant="info"
            description="You're already subscribed to this channel."
          />
        ) : existingRequest ? (
          <Callout
            variant={
              existingRequest.status === 'pending'
                ? 'warning'
                : existingRequest.status === 'accepted'
                  ? 'success'
                  : 'destructive'
            }
            description={
              existingRequest.status === 'pending'
                ? 'Your join request is pending approval.'
                : existingRequest.status === 'accepted'
                  ? 'Your request was accepted! You should see posts from this channel in your feed.'
                  : 'Your join request was declined.'
            }
          />
        ) : (
          <View style={styles.joinSection}>
            <Text style={[styles.label, { color: theme.foreground }]}>
              Introduce yourself (optional, max 300 chars)
            </Text>
            <Textarea
              value={message}
              onChangeText={setMessage}
              placeholder="Hi! I'm..."
              maxLength={300}
              rows={3}
            />
            <Button
              onPress={handleJoinRequest}
              loading={loading}
              style={{ marginTop: 12 }}
            >
              Request to Join
            </Button>
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    padding: 24,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  channelInfo: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  ownerName: {
    fontSize: 13,
  },
  joinSection: {
    gap: 8,
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
