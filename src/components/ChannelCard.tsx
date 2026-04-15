import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
            {channel.subscribers.length} subscriber
            {channel.subscribers.length !== 1 ? 's' : ''}
          </Text>
          {owner && (
            <Text style={[styles.metaText, { color: theme.mutedForeground }]}>
              by {owner.firstName} {owner.lastName}
            </Text>
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
                Unsubscribe
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
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});
