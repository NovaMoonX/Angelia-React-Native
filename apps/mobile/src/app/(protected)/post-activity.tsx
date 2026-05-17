import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, type ViewToken, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useTheme } from '@/hooks/useTheme';
import { useAuthorPostActivity } from '../../hooks/useAuthorPostActivity';

import { PostCard } from '@/components/PostCard';
import { useAppSelector } from '@/store/hooks';
import { selectAllChannels } from '@/store/slices/channelsSlice';
import {
  selectCurrentUserUploadingPosts,
  selectCurrentUserUploadProgressMap,
} from '@/store/crossSelectors/activitySelectors';
import type { Post } from '@/models/types';

type SortOrder = 'newest' | 'oldest';



export default function PostActivityScreen() {
  const router = useRouter();
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { summaries, unreadDetailsByPostId, refreshSeenState, markPostsSeen } = useAuthorPostActivity();
  const channels = useAppSelector(selectAllChannels);
  const uploadingPosts = useAppSelector(selectCurrentUserUploadingPosts);
  const uploadProgressMap = useAppSelector(selectCurrentUserUploadProgressMap);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const [selectedCircleId, setSelectedCircleId] = useState<string>('all');
  const [activityScope, setActivityScope] = useState<'all' | 'unread' | 'uploading'>(scope === 'unread' ? 'unread' : scope === 'uploading' ? 'uploading' : 'all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [refreshing, setRefreshing] = useState(false);
  const markPostsSeenRef = useRef(markPostsSeen);
  const pendingSeenPostIdsRef = useRef<Set<string>>(new Set());
  const lastVisibleKeyRef = useRef('');
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 98 }).current;



  const handleBackPress = useCallback(() => {
    router.dismissTo('/(protected)/feed');
  }, [router]);

  useEffect(() => {
    markPostsSeenRef.current = markPostsSeen;
  }, [markPostsSeen]);

  const flushPendingSeen = useCallback(async () => {
    const pendingPostIds = Array.from(pendingSeenPostIdsRef.current);
    if (pendingPostIds.length === 0) return;
    pendingSeenPostIdsRef.current.clear();
    await markPostsSeenRef.current(pendingPostIds);
  }, []);

  const filteredByCircle = useMemo(() => {
    if (selectedCircleId === 'all') return summaries;
    return summaries.filter((summary) => {
      return summary.post.channelId === selectedCircleId;
    });
  }, [selectedCircleId, summaries]);

  useFocusEffect(
    useCallback(() => {
      void refreshSeenState().catch(() => {});
      return () => {
        void flushPendingSeen().catch(() => {});
      };
    }, [flushPendingSeen, refreshSeenState, summaries.length, unreadDetailsByPostId]),
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

  const filteredUploadingPosts = useMemo(() => {
    let result = uploadingPosts;

    if (selectedCircleId !== 'all') {
      result = result.filter((post) => {
        return post.channelId === selectedCircleId;
      });
    }

    const sorted = [...result].sort((a, b) => {
      if (sortOrder === 'newest') {
        return b.timestamp - a.timestamp;
      }
      return a.timestamp - b.timestamp;
    });

    return sorted;
  }, [uploadingPosts, selectedCircleId, sortOrder]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const fullyVisiblePostIds = viewableItems
      .map((token) => {
        const item = token.item as (typeof filtered)[number] | Post | undefined;
        if (token.isViewable !== true) return null;
        if (item && 'post' in item && item.post?.id) {
          return item.post.id;
        }
        return null;
      })
      .filter((id): id is string => {
        return id != null;
      });

    if (fullyVisiblePostIds.length === 0) {
      lastVisibleKeyRef.current = '';
      return;
    }

    const nextKey = fullyVisiblePostIds.join('|');
    if (nextKey === lastVisibleKeyRef.current) return;
    lastVisibleKeyRef.current = nextKey;
    fullyVisiblePostIds.forEach((postId) => {
      pendingSeenPostIdsRef.current.add(postId);
    });
  }).current;

  const renderSummaryCard = useCallback(({ item }: { item: (typeof filtered)[number] }) => {
    const detail = unreadDetailsByPostId[item.post.id];
    const shouldShowNewActivityLabel = detail != null && (
      detail.hasNewReactions || detail.hasNewPrivateNotes || detail.hasNewMessages
    );
    const newActivityTypes: string[] = [];
    if (detail?.hasNewReactions) newActivityTypes.push('reactions');
    if (detail?.hasNewPrivateNotes) newActivityTypes.push('private notes');
    if (detail?.hasNewMessages) newActivityTypes.push('messages');

    return (
      <View>
        <PostCard
          post={item.post}
          onNavigate={() => {
            router.push({
              pathname: '/(protected)/post/[id]',
              params: { id: item.post.id, from: 'post-activity' },
            });
          }}
        />
        {shouldShowNewActivityLabel ? (
          <Text style={[styles.newActivityText, { color: theme.primary }]}>
            {`New ${newActivityTypes.join(' + ')} since your last app open`}
          </Text>
        ) : null}
      </View>
    );
  }, [router, theme.primary, unreadDetailsByPostId]);

  const renderUploadingCard = useCallback(({ item }: { item: Post }) => {
    const progress = Math.round((uploadProgressMap[item.id] ?? 0) * 100);
    return (
      <View>
        <PostCard
          post={item}
          onNavigate={() => {
            router.push({
              pathname: '/(protected)/post/[id]',
              params: { id: item.id, from: 'post-activity' },
            });
          }}
        />
        <Text style={[styles.newActivityText, { color: theme.primary }]}>Uploading now... {progress}% complete.</Text>
      </View>
    );
  }, [router, theme.primary, uploadProgressMap]);

  const listHeader = (
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
          onPress={() => {
            setActivityScope('all');
          }}
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
          onPress={() => {
            setActivityScope('unread');
          }}
          style={[
            styles.filterChip,
            styles.filterChipRow,
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
            Unread Only ({unreadPostIdSet.size})
          </Text>
          {unreadPostIdSet.size > 0 && activityScope !== 'unread' && (
            <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setActivityScope('uploading');
          }}
          style={[
            styles.filterChip,
            {
              borderColor: activityScope === 'uploading' ? theme.primary : theme.border,
              backgroundColor: activityScope === 'uploading' ? `${theme.primary}18` : theme.card,
            },
          ]}
        >
          <Text
            style={[
              styles.filterChipText,
              { color: activityScope === 'uploading' ? theme.primary : theme.foreground },
            ]}
          >
            Uploading ({uploadingPosts.length})
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
  );

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title='Your Post Activity' onBack={handleBackPress} />
      {activityScope === 'uploading' ? (
        <FlashList
          style={{ flex: 1, backgroundColor: theme.background }}
          data={filteredUploadingPosts}
          keyExtractor={(item) => {
            return item.id;
          }}
          renderItem={renderUploadingCard}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📬</Text>
              <Text style={[styles.emptyTitle, { color: theme.foreground }]}>No posts here yet</Text>
              <Text style={[styles.emptyBody, { color: theme.mutedForeground }]}>No uploads in progress right now.</Text>
            </Card>
          }
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
        />
      ) : (
        <FlashList
          style={{ flex: 1, backgroundColor: theme.background }}
          data={filtered}
          keyExtractor={(item) => {
            return item.post.id;
          }}
          renderItem={renderSummaryCard}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📬</Text>
              <Text style={[styles.emptyTitle, { color: theme.foreground }]}>No posts here yet</Text>
              <Text style={[styles.emptyBody, { color: theme.mutedForeground }]}> 
                {activityScope === 'unread'
                  ? 'You are all caught up in this Circle.'
                  : 'Your activity shows up here once you share in this Circle.'}
              </Text>
            </Card>
          }
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
        />
      )}
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
  filterChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
