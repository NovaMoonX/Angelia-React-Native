import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppSelector } from '@/store/hooks';
import { useTheme } from '@/hooks/useTheme';
import { selectMyPeopleData } from '@/store/crossSelectors/myPeopleSelectors';
import type { User } from '@/models/types';

interface PersonRowProps {
  user: User;
  tag?: string;
  onPress?: () => void;
}

function PersonRow({ user, tag, onPress }: PersonRowProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.personRow,
        { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Avatar preset={user.avatar} size="sm" />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.personName, { color: theme.foreground }]}>
          {user.firstName} {user.lastName}
        </Text>
        {user.funFact ? (
          <Text
            style={[styles.personFact, { color: theme.mutedForeground }]}
            numberOfLines={1}
          >
            {user.funFact}
          </Text>
        ) : null}
      </View>
      {tag ? (
        <View style={[styles.tagPill, { backgroundColor: theme.secondary }]}>
          <Text style={[styles.tagText, { color: theme.secondaryForeground }]}>{tag}</Text>
        </View>
      ) : null}
      {onPress ? (
        <Feather name="chevron-right" size={16} color={theme.mutedForeground} style={{ marginLeft: 4 }} />
      ) : null}
    </Pressable>
  );
}

export default function MyPeopleScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const { directConnections, circleOnlyMembers } = useAppSelector(selectMyPeopleData);

  const totalCount = directConnections.length + circleOnlyMembers.length;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'My People',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.foreground,
          headerTitleStyle: { fontWeight: '700' },
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/(protected)/share-connection')}
              hitSlop={8}
              style={{ marginRight: 4 }}
            >
              <Feather name="user-plus" size={22} color={theme.primary} />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 16, paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* Share connection link CTA */}
        <Card style={{ ...styles.shareCard, borderColor: theme.primary }}>
          <Text style={[styles.shareTitle, { color: theme.foreground }]}>
            🤝 Grow your people
          </Text>
          <Text style={[styles.shareSubtitle, { color: theme.mutedForeground }]}>
            Share your connection link or QR code so people can request to connect with you.
          </Text>
          <Button
            size="sm"
            onPress={() => router.push('/(protected)/share-connection')}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            Share My Link
          </Button>
        </Card>

        {totalCount === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🫶</Text>
            <Text style={[styles.emptyText, { color: theme.foreground }]}>
              No people yet
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.mutedForeground }]}>
              Share your connection link to invite people into your world. Once they connect, they'll show up here.
            </Text>
          </View>
        ) : (
          <>
            {/* Direct connections */}
            {directConnections.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>
                  CONNECTIONS ({directConnections.length})
                </Text>
                {directConnections.map((user) => (
                  <PersonRow
                    key={user.id}
                    user={user}
                    tag="Connected"
                    onPress={() =>
                      router.push({
                        pathname: '/(protected)/feed',
                        params: { filterUserId: user.id },
                      })
                    }
                  />
                ))}
              </View>
            )}

            {/* Circle people */}
            {circleOnlyMembers.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>
                  IN YOUR CIRCLES ({circleOnlyMembers.length})
                </Text>
                {circleOnlyMembers.map((user) => (
                  <PersonRow key={user.id} user={user} tag="Circle Member" />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
  shareCard: {
    padding: 16,
    borderWidth: 1.5,
    gap: 8,
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  shareSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 52,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  personName: {
    fontSize: 15,
    fontWeight: '600',
  },
  personFact: {
    fontSize: 13,
    marginTop: 1,
  },
  tagPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
