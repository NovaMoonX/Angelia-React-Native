import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Animated,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
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
import { NowStatusBadge } from '@/components/NowStatusBadge';
import { NowStatusModal } from '@/components/NowStatusModal';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { saveStatus, clearStatus } from '@/store/actions/userActions';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import type { Post, UserStatus } from '@/models/types';

const INITIAL_PAGE = 10;
const LOAD_MORE = 3;

export default function FeedScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();

  const posts = useAppSelector((state) => state.posts.items);
  const channels = useAppSelector((state) => state.channels.items);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const hasIncoming = useAppSelector(
    (state) => state.invites.incoming.some((r) => r.status === 'pending')
  );

  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [displayCount, setDisplayCount] = useState(INITIAL_PAGE);
  const [fabExpanded, setFabExpanded] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Animated header (slides up on scroll-down, back on scroll-up)
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const prevScrollY = useRef(0);
  const headerVisible = useRef(true);
  const headerAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const [scrolledPast, setScrolledPast] = useState(false);

  const channelOptions = useMemo(
    () => [
      { text: 'All Channels', value: 'all' },
      { text: 'Daily Channels', value: 'daily' },
      ...channels
        .filter((ch) => !ch.isDaily)
        .map((ch) => ({ text: ch.name, value: ch.id })),
    ],
    [channels]
  );

  const filteredPosts = useMemo(() => {
    let result = [...posts].filter((p) => p.status === 'ready');

    if (channelFilter === 'daily') {
      const dailyChannelIds = channels
        .filter((ch) => ch.isDaily)
        .map((ch) => ch.id);
      result = result.filter((p) => dailyChannelIds.includes(p.channelId));
    } else if (channelFilter !== 'all') {
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
    let total: number;
    if (channelFilter === 'all') {
      total = posts.filter((p) => p.status === 'ready').length;
    } else if (channelFilter === 'daily') {
      const dailyChannelIds = channels
        .filter((ch) => ch.isDaily)
        .map((ch) => ch.id);
      total = posts.filter(
        (p) => p.status === 'ready' && dailyChannelIds.includes(p.channelId)
      ).length;
    } else {
      total = posts.filter(
        (p) => p.channelId === channelFilter && p.status === 'ready'
      ).length;
    }
    return displayCount < total;
  }, [posts, channels, channelFilter, displayCount]);

  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayCount((prev) => prev + LOAD_MORE);
    }
  }, [hasMore]);

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const animateHeader = useCallback(
    (toValue: number, duration: number) => {
      headerAnimation.current?.stop();
      headerAnimation.current = Animated.timing(headerTranslateY, {
        toValue,
        duration,
        useNativeDriver: true,
      });
      headerAnimation.current.start();
    },
    [headerTranslateY]
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const delta = currentY - prevScrollY.current;
      const threshold = headerHeight;

      if (currentY <= 0 && !headerVisible.current) {
        headerVisible.current = true;
        animateHeader(0, 150);
      } else if (delta > 5 && currentY > threshold && headerVisible.current) {
        headerVisible.current = false;
        animateHeader(-threshold, 200);
      } else if (delta < -5 && !headerVisible.current) {
        headerVisible.current = true;
        animateHeader(0, 200);
      }

      setScrolledPast(currentY > 100);
      prevScrollY.current = currentY;
    },
    [animateHeader, headerHeight]
  );

  const handleSaveStatus = useCallback(
    async (status: UserStatus) => {
      try {
        await dispatch(saveStatus(status)).unwrap();
        addToast({ type: 'success', title: 'Status updated!' });
        setStatusModalOpen(false);
      } catch {
        addToast({ type: 'error', title: 'Failed to set status' });
      }
    },
    [dispatch, addToast],
  );

  const handleClearStatus = useCallback(async () => {
    try {
      await dispatch(clearStatus()).unwrap();
      addToast({ type: 'success', title: 'Status cleared' });
      setStatusModalOpen(false);
    } catch {
      addToast({ type: 'error', title: 'Failed to clear status' });
    }
  }, [dispatch, addToast]);

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard
        post={item}
        onNavigate={() => router.push(`/(protected)/post/${item.id}`)}
      />
    ),
    [router]
  );

  // In demo mode the DemoModeBanner already consumes the top safe-area inset,
  // so the feed header only needs a small breathing-room top padding.
  const headerPaddingTop = isDemo ? 12 : insets.top + 12;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Post List — fills the full container; paddingTop reserves space for the absolute header */}
      <FlatList
        ref={flatListRef}
        data={filteredPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight, paddingBottom: insets.bottom + 150 },
        ]}
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

      {/* Animated header — absolute so it slides up without affecting FlatList layout */}
      <Animated.View
        style={[
          styles.headerContainer,
          {
            backgroundColor: theme.background,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        {/* Header Bar */}
        <View style={[styles.headerBar, { paddingTop: headerPaddingTop }]}>
          <View style={styles.headerSide}>
            <Pressable onPress={() => router.push('/(protected)/account')}>
              <Avatar
                preset={currentUser?.avatar || 'moon'}
                size="sm"
              />
            </Pressable>
          </View>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.foreground }]}>
              Angelia
            </Text>
            <NowStatusBadge status={currentUser?.status} />
          </View>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            <Pressable onPress={() => router.push('/(protected)/notifications')}>
              <BellIcon hasNotification={hasIncoming} />
            </Pressable>
          </View>
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
      </Animated.View>

      {/* Dim overlay when FAB expanded */}
      {fabExpanded && (
        <Pressable
          style={styles.overlay}
          onPress={() => setFabExpanded(false)}
        />
      )}

      {/* Expanded FAB actions */}
      {fabExpanded && (
        <View style={[styles.fabMenu, { bottom: insets.bottom + 92 }]}>
          {/* Set Status */}
          <Pressable
            style={[styles.fabMenuItem, { backgroundColor: theme.secondary }]}
            onPress={() => {
              setFabExpanded(false);
              setStatusModalOpen(true);
            }}
          >
            <Feather name="smile" size={18} color={theme.secondaryForeground} />
            <Text style={[styles.fabMenuLabel, { color: theme.secondaryForeground }]}>
              Status
            </Text>
          </Pressable>

          {/* Media (camera / gallery) */}
          <Pressable
            style={[styles.fabMenuItem, { backgroundColor: theme.secondary }]}
            onPress={() => {
              setFabExpanded(false);
              router.push('/(protected)/camera');
            }}
          >
            <Feather name="camera" size={18} color={theme.secondaryForeground} />
            <Text style={[styles.fabMenuLabel, { color: theme.secondaryForeground }]}>
              Media
            </Text>
          </Pressable>

          {/* Compose (text post) */}
          <Pressable
            style={[styles.fabMenuItemPrimary, { backgroundColor: theme.primary }]}
            onPress={() => {
              setFabExpanded(false);
              router.push('/(protected)/post/new');
            }}
          >
            <Feather name="edit-2" size={18} color={theme.primaryForeground} />
            <Text style={[styles.fabMenuLabelPrimary, { color: theme.primaryForeground }]}>
              Compose
            </Text>
          </Pressable>
        </View>
      )}

      {/* Primary FAB — "+" */}
      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: fabExpanded ? theme.foreground : theme.primary,
            bottom: insets.bottom + 24,
          },
        ]}
        onPress={() => setFabExpanded((prev) => !prev)}
      >
        <Feather
          name={fabExpanded ? 'x' : 'plus'}
          size={24}
          color={fabExpanded ? theme.background : theme.primaryForeground}
        />
      </Pressable>

      {/* Scroll to Top FAB — only when feed has posts and user has scrolled past first post */}
      {!fabExpanded && scrolledPast && filteredPosts.length > 0 && (
        <Pressable
          style={[styles.scrollTopFab, { backgroundColor: theme.secondary, bottom: insets.bottom + 90 }]}
          onPress={scrollToTop}
        >
          <Feather name="arrow-up" size={18} color={theme.secondaryForeground} />
        </Pressable>
      )}

      {/* Solid background behind system nav buttons */}
      {insets.bottom > 0 && (
        <View style={[styles.bottomBar, {
          height: insets.bottom,
          backgroundColor: theme.background,
        }]} />
      )}

      {/* Status modal */}
      <NowStatusModal
        visible={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onSave={handleSaveStatus}
        onClear={handleClearStatus}
        currentStatus={currentUser?.status}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerSide: {
    width: 40,
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 10,
  },
  fabMenu: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    gap: 12,
    zIndex: 20,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  fabMenuLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  fabMenuItemPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 28,
    gap: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabMenuLabelPrimary: {
    fontSize: 15,
    fontWeight: '700',
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
    zIndex: 20,
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
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
