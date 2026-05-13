import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useTheme } from '@/hooks/useTheme';
import { useAuthorPostActivity } from '../../hooks/useAuthorPostActivity';
import { PostCard } from '@/components/PostCard';
import { useAppSelector } from '@/store/hooks';
import { selectAllChannels } from '@/store/slices/channelsSlice';

type SortOrder = 'newest' | 'oldest';

export default function PostActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { summaries, unreadDetailsByPostId, refreshSeenState } = useAuthorPostActivity({ enableSubscriptions: true });
  const channels = useAppSelector(selectAllChannels);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const [selectedCircleId, setSelectedCircleId] = useState<string>('all');
  const [activityScope, setActivityScope] = useState<'all' | 'unread'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [refreshing, setRefreshing] = useState(false);

  // Auto-select 'unread' the first time unread activity is detected after load.
  const hasAutoSelectedUnread = useRef(false);
  useEffect(() => {
    if (hasAutoSelectedUnread.current) return;
    if (Object.keys(unreadDetailsByPostId).length > 0) {
      hasAutoSelectedUnread.current = true;
      setActivityScope('unread');
    }
  }, [unreadDetailsByPostId]);

  useEffect(() => {
    if (Object.keys(unreadDetailsByPostId).length > 0) return;
    hasAutoSelectedUnread.current = false;
    if (activityScope === 'unread') {
      setActivityScope('all');
    }
  }, [activityScope, unreadDetailsByPostId]);

  const filteredByCircle = useMemo(() => {
    if (selectedCircleId === 'all') return summaries;
    return summaries.filter((summary) => {
      return summary.post.channelId === selectedCircleId;
    });
  }, [selectedCircleId, summaries]);

  useFocusEffect(
    useCallback(() => {
      void refreshSeenState();
    }, [refreshSeenState]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshSeenState().catch(() => {});
    setRefreshing(false);
  }, [refreshSeenState]);

  const circles = useMemo(() => {
    if (!currentUser) return [];

    return channels
      .filter((channel) => {
        return channel.ownerId === currentUser.id;
      })
      .map((channel) => {
        if (channel.isDaily === true) {
          return {
            id: channel.id,
            label: 'Daily Circle',
            isDaily: true,
          };
        }

        return {
          id: channel.id,
          label: channel.name,
          isDaily: false,
        };
      })
      .sort((a, b) => {
        if (a.isDaily && !b.isDaily) return -1;
        if (!a.isDaily && b.isDaily) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [channels, currentUser]);

  const unreadPostIdSet = useMemo(() => {
    return new Set(Object.keys(unreadDetailsByPostId));
  }, [unreadDetailsByPostId]);

  const filtered = useMemo(() => {
    let result = filteredByCircle;
    
    if (activityScope === 'unread') {
      result = result.filter((summary) => {
        return unreadPostIdSet.has(summary.post.id);
      });
    }

    // Sort based on sortOrder
    const sorted = [...result].sort((a, b) => {
      const aTimestamp = a.post.timestamp;
      const bTimestamp = b.post.timestamp;
      
      if (sortOrder === 'newest') {
        return bTimestamp - aTimestamp;
      } else {
        return aTimestamp - bTimestamp;
      }
    });

    return sorted;
  }, [activityScope, filteredByCircle, unreadPostIdSet, sortOrder]);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title='Your Post Activity' />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: 12,
            paddingBottom: insets.bottom + 36,
          },
        ]}
      >
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: theme.mutedForeground }]}>Filter by Circle</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Pressable
              onPress={() => setSelectedCircleId('all')}
              style={[
                styles.filterChip,
                {
                  borderColor: selectedCircleId === 'all' ? theme.primary : theme.border,
                  backgroundColor: selectedCircleId === 'all' ? `${theme.primary}18` : theme.card,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedCircleId === 'all' ? theme.primary : theme.foreground },
                ]}
              >
                All Circles
              </Text>
            </Pressable>

            {circles.map((circle) => {
              const active = selectedCircleId === circle.id;
              return (
                <Pressable
                  key={circle.id}
                  onPress={() => setSelectedCircleId(circle.id)}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active ? `${theme.primary}18` : theme.card,
                    },
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: active ? theme.primary : theme.foreground }]}>
                    {circle.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.filterLabel, { color: theme.mutedForeground }]}>Show</Text>
          <View style={styles.scopeRow}>
            <Pressable
              onPress={() => setActivityScope('all')}
              style={[
                styles.filterChip,
                {
                  borderColor: activityScope === 'all' ? theme.primary : theme.border,
                  backgroundColor: activityScope === 'all' ? `${theme.primary}18` : theme.card,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: activityScope === 'all' ? theme.primary : theme.foreground },
                ]}
              >
                All Activity
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActivityScope('unread')}
              style={[
                styles.filterChip,
                {
                  borderColor: activityScope === 'unread' ? theme.primary : theme.border,
                  backgroundColor: activityScope === 'unread' ? `${theme.primary}18` : theme.card,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: activityScope === 'unread' ? theme.primary : theme.foreground },
                ]}
              >
                Unread Only
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.filterLabel, { color: theme.mutedForeground }]}>Sort by</Text>
          <View style={styles.scopeRow}>
            <Pressable
              onPress={() => setSortOrder('newest')}
              style={[
                styles.filterChip,
                {
                  borderColor: sortOrder === 'newest' ? theme.primary : theme.border,
                  backgroundColor: sortOrder === 'newest' ? `${theme.primary}18` : theme.card,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: sortOrder === 'newest' ? theme.primary : theme.foreground },
                ]}
              >
                Newest
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSortOrder('oldest')}
              style={[
                styles.filterChip,
                {
                  borderColor: sortOrder === 'oldest' ? theme.primary : theme.border,
                  backgroundColor: sortOrder === 'oldest' ? `${theme.primary}18` : theme.card,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: sortOrder === 'oldest' ? theme.primary : theme.foreground },
                ]}
              >
                Oldest
              </Text>
            </Pressable>
          </View>
        </View>

        {filtered.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📬</Text>
            <Text style={[styles.emptyTitle, { color: theme.foreground }]}>No posts here yet</Text>
            <Text style={[styles.emptyBody, { color: theme.mutedForeground }]}>
              {activityScope === 'unread'
                ? 'You are all caught up in this Circle.'
                : 'Your activity shows up here once you share in this Circle.'}
            </Text>
          </Card>
        ) : (
          filtered.map((summary) => {
            const detail = unreadDetailsByPostId[summary.post.id];
            const shouldShowNewActivityLabel = detail != null && (
              detail.hasNewReactions || detail.hasNewPrivateNotes || detail.hasNewMessages
            );
            const newActivityTypes: string[] = [];
            if (detail?.hasNewReactions) newActivityTypes.push('reactions');
            if (detail?.hasNewPrivateNotes) newActivityTypes.push('private notes');
            if (detail?.hasNewMessages) newActivityTypes.push('messages');

            return (
              <View key={summary.post.id}>
                <PostCard
                  post={summary.post}
                  onNavigate={() => {
                    router.push(`/(protected)/post/${summary.post.id}`);
                  }}
                />
                {shouldShowNewActivityLabel ? (
                  <Text style={[styles.newActivityText, { color: theme.primary }]}>
                    {`New ${newActivityTypes.join(' + ')} since your last app open`}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    gap: 10,
  },
  filterSection: {
    gap: 8,
    marginBottom: 6,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  filterRow: {
    gap: 8,
    paddingRight: 8,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    marginTop: 8,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 34,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
  },
  newActivityText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4,
    marginBottom: 8,
    marginLeft: 4,
  },
});
