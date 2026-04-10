import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Select } from '@/components/ui/Select';
import { BellIcon } from '@/components/BellIcon';
import { PostCard } from '@/components/PostCard';
import { SkeletonPostCard } from '@/components/SkeletonPostCard';
import { useAppSelector } from '@/store/hooks';
import { useTheme } from '@/hooks/useTheme';
import type { Post } from '@/models/types';

const INITIAL_PAGE = 10;
const LOAD_MORE = 3;

export default function FeedScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const posts = useAppSelector((state) => state.posts.items);
  const channels = useAppSelector((state) => state.channels.items);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const hasIncoming = useAppSelector(
    (state) => state.invites.incoming.filter((r) => r.status === 'pending').length > 0
  );

  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [displayCount, setDisplayCount] = useState(INITIAL_PAGE);
  const flatListRef = useRef<FlatList>(null);

  const channelOptions = useMemo(
    () => [
      { text: 'All Channels', value: 'all' },
      ...channels.map((ch) => ({ text: ch.name, value: ch.id })),
    ],
    [channels]
  );

  const filteredPosts = useMemo(() => {
    let result = [...posts].filter((p) => p.status === 'ready');

    if (channelFilter !== 'all') {
      result = result.filter((p) => p.channelId === channelFilter);
    }

    result.sort((a, b) =>
      sortOrder === 'newest'
        ? b.timestamp - a.timestamp
        : a.timestamp - b.timestamp
    );

    return result.slice(0, displayCount);
  }, [posts, channelFilter, sortOrder, displayCount]);

  const hasMore = useMemo(() => {
    const total =
      channelFilter === 'all'
        ? posts.filter((p) => p.status === 'ready').length
        : posts.filter(
            (p) => p.channelId === channelFilter && p.status === 'ready'
          ).length;
    return displayCount < total;
  }, [posts, channelFilter, displayCount]);

  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayCount((prev) => prev + LOAD_MORE);
    }
  }, [hasMore]);

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard
        post={item}
        onNavigate={() => router.push(`/(protected)/post/${item.id}`)}
      />
    ),
    [router]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.push('/(protected)/account')}>
          <Avatar
            preset={currentUser?.avatar || 'moon'}
            size="sm"
          />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.foreground }]}>
          Feed
        </Text>
        <Pressable onPress={() => router.push('/(protected)/account')}>
          <BellIcon hasNotification={hasIncoming} />
        </Pressable>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <Select
            value={channelFilter}
            onChange={setChannelFilter}
            options={channelOptions}
          />
        </View>
        <Pressable
          onPress={() =>
            setSortOrder((prev) =>
              prev === 'newest' ? 'oldest' : 'newest'
            )
          }
          style={[styles.sortButton, { borderColor: theme.border }]}
        >
          <Feather
            name={sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'}
            size={16}
            color={theme.foreground}
          />
        </Pressable>
      </View>

      {/* Post List */}
      <FlatList
        ref={flatListRef}
        data={filteredPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text
              style={[styles.emptyText, { color: theme.mutedForeground }]}
            >
              No posts yet. Create your first post!
            </Text>
          </View>
        }
        ListFooterComponent={
          hasMore ? <SkeletonPostCard /> : null
        }
      />

      {/* New Post FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + 24 }]}
        onPress={() => router.push('/(protected)/post/new')}
      >
        <Feather name="plus" size={24} color={theme.primaryForeground} />
      </Pressable>

      {/* Scroll to Top FAB */}
      <Pressable
        style={[styles.scrollTopFab, { backgroundColor: theme.secondary, bottom: insets.bottom + 90 }]}
        onPress={scrollToTop}
      >
        <Feather name="arrow-up" size={18} color={theme.secondaryForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  sortButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  scrollTopFab: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});
