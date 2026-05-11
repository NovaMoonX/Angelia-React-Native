import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Channel } from '@/models/types';
import { useTheme } from '@/hooks/useTheme';

export interface CircleJoinSuggestionItem {
  channel: Channel;
  isRequested: boolean;
}

interface CircleJoinSuggestionsModalProps {
  isOpen: boolean;
  authorName: string;
  items: CircleJoinSuggestionItem[];
  requestingChannelId: string | null;
  onRequestJoin: (channel: Channel) => void;
  onNotInterested: (channelId: string) => void;
  onLeavePage: () => void;
  onStayHere: () => void;
}

export function CircleJoinSuggestionsModal({
  isOpen,
  authorName,
  items,
  requestingChannelId,
  onRequestJoin,
  onNotInterested,
  onLeavePage,
  onStayHere,
}: CircleJoinSuggestionsModalProps) {
  const { theme } = useTheme();

  return (
    <Modal isOpen={isOpen} onClose={onStayHere} title={`More of ${authorName}'s Circles`}>
      <View style={styles.container}>
        <Text style={[styles.subtitle, { color: theme.mutedForeground }]}> 
          You reacted to their post. Want to peek at a few more of their Circles before you go?
        </Text>

        {items.map((item) => (
          <Card key={item.channel.id} style={styles.card}>
            <Text style={[styles.channelName, { color: theme.foreground }]}> 
              {item.channel.name}
            </Text>
            {item.channel.description ? (
              <Text style={[styles.channelDescription, { color: theme.mutedForeground }]}> 
                {item.channel.description}
              </Text>
            ) : null}
            <Text style={[styles.channelMeta, { color: theme.mutedForeground }]}> 
              {item.channel.subscribers.length} member{item.channel.subscribers.length !== 1 ? 's' : ''}
            </Text>

            <View style={styles.buttonRow}>
              <Button
                variant="outline"
                size="sm"
                onPress={() => onNotInterested(item.channel.id)}
                style={{ flex: 1 }}
              >
                Not interested
              </Button>
              <Button
                size="sm"
                onPress={() => onRequestJoin(item.channel)}
                disabled={item.isRequested || requestingChannelId === item.channel.id}
                loading={requestingChannelId === item.channel.id}
                style={{ flex: 1 }}
              >
                {item.isRequested ? 'Requested' : 'Request to Join'}
              </Button>
            </View>
          </Card>
        ))}

        <View style={styles.footerActions}>
          <Button variant="outline" onPress={onStayHere} style={{ flex: 1 }}>
            Keep browsing
          </Button>
          <Button onPress={onLeavePage} style={{ flex: 1 }}>
            Leave page
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    gap: 8,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '700',
  },
  channelDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  channelMeta: {
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});
