import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getColorPair } from '@/lib/channel/channel.utils';
import type { Channel, User } from '@/models/types';
import { useTheme } from '@/hooks/useTheme';

interface ChannelCardProps {
  channel: Channel;
  owner?: User;
  onEdit?: () => void;
  onDelete?: () => void;
  onUnsubscribe?: () => void;
  onClick?: () => void;
  isOwner?: boolean;
  isLoading?: boolean;
}

export function ChannelCard({
  channel,
  owner,
  onEdit,
  onDelete,
  onUnsubscribe,
  onClick,
  isOwner = false,
  isLoading = false,
}: ChannelCardProps) {
  const { theme } = useTheme();
  const colors = getColorPair(channel);
  const memberCount = channel.subscribers.length;

  return (
    <Pressable onPress={onClick}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Badge
            style={{
              backgroundColor: colors.backgroundColor,
              borderColor: colors.backgroundColor,
            }}
            textStyle={{ color: colors.textColor }}
          >
            {channel.name}
          </Badge>
          {channel.isPrivate && (
            <Text style={[styles.privateBadge, { color: theme.mutedForeground }]}>🔒 Private</Text>
          )}
        </View>

        {channel.description ? (
          <Text
            style={[styles.description, { color: theme.mutedForeground }]}
            numberOfLines={2}
          >
            {channel.description}
          </Text>
        ) : null}

        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: theme.mutedForeground }]}>
            {memberCount} member
            {memberCount !== 1 ? 's' : ''}
          </Text>
          {owner && (
            <View style={styles.ownerRow}>
              <Avatar user={owner} size="sm" showStatus={false} />
              <Text style={[styles.metaText, { color: theme.mutedForeground }]}>
                {owner.firstName} {owner.lastName}
              </Text>
            </View>
          )}
        </View>

        {(isOwner || onUnsubscribe) && (
          <View style={styles.actions}>
            {isOwner && onEdit && !channel.isDaily && (
              <Button variant="outline" size="sm" onPress={onEdit}>
                Edit
              </Button>
            )}
            {isOwner && onDelete && !channel.isDaily && (
              <Button
                variant="destructive"
                size="sm"
                onPress={onDelete}
                loading={isLoading}
              >
                <Feather name="trash-2" size={14} color="#FFFFFF" />
              </Button>
            )}
            {!isOwner && onUnsubscribe && (
              <Button
                variant="outline"
                size="sm"
                onPress={onUnsubscribe}
                loading={isLoading}
              >
                Leave
              </Button>
            )}
          </View>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  privateBadge: {
    fontSize: 11,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});
