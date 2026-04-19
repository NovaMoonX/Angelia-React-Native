import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { BellIcon } from '@/components/BellIcon';
import { PostCard } from '@/components/PostCard';
import { SkeletonPostCard } from '@/components/SkeletonPostCard';
import { isStatusActive } from '@/components/NowStatusBadge';
import { NowStatusModal } from '@/components/NowStatusModal';
import { FeedChannelFilterModal, type ChannelFilterState } from '@/components/FeedChannelFilterModal';
import { formatTimeRemaining } from '@/lib/timeUtils';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { saveStatus, clearStatus } from '@/store/actions/userActions';
import { selectHasAnyPendingActivity } from '@/store/crossSelectors/activitySelectors';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { POST_TIERS } from '@/models/constants';
import type { Post, PostTier, UserStatus } from '@/models/types';

const INITIAL_PAGE = 10;
const LOAD_MORE = 3;
const FILTERING_INDICATOR_DURATION = 400;

export default function FeedScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();

  const posts = useAppSelector((state) => state.posts.items);
  const postsLoaded = useAppSelector((state) => state.posts.loaded);
  const channels = useAppSelector((state) => state.channels.items);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const hasPendingActivity = useAppSelector(selectHasAnyPendingActivity);

  const [channelFilter, setChannelFilter] = useState<ChannelFilterState>({ mode: 'all', specificIds: [] });
  const [channelFilterOpen, setChannelFilterOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PostTier[]>([]);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [displayCount, setDisplayCount] = useState(INITIAL_PAGE);
  const [fabExpanded, setFabExpanded] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const isMountedRef = useRef(false);
  const flatListRef = useRef<FlashListRef<Post>>(null);

  // Animated dots for filtering indicator
  const filteringOpacity = useRef(new Animated.Value(0)).current;
  const dot1Scale = useRef(new Animated.Value(1)).current;
  const dot2Scale = useRef(new Animated.Value(1)).current;
  const dot3Scale = useRef(new Animated.Value(1)).current;
  const dotLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Animated header (slides up on scroll-down, back on scroll-up)
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const prevScrollY = useRef(0);
  const headerVisible = useRef(true);
  const headerAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const [scrolledPast, setScrolledPast] = useState(false);

  const channelFilterLabel = useMemo(() => {
    if (channelFilter.mode === 'all') return 'All Circles';
    if (channelFilter.mode === 'others') return "Others' Circles";
    const count = channelFilter.specificIds.length;
    if (count === 0) return 'All Circles';
    if (count === 1) {
      const ch = channels.find((c) => c.id === channelFilter.specificIds[0]);
      return ch?.name ?? '1 Circle';
    }
    return `${count} Circles`;
  }, [channelFilter, channels]);

  // Pre-compute the set of allowed channel IDs based on the filter (null = all)
  const allowedChannelIds = useMemo((): Set<string> | null => {
    if (channelFilter.mode === 'all') return null;
    if (channelFilter.mode === 'others') {
      return new Set(
        channels.filter((ch) => ch.ownerId !== currentUser?.id).map((ch) => ch.id),
      );
    }
    // specific mode
    if (channelFilter.specificIds.length === 0) return null;
    return new Set(channelFilter.specificIds);
  }, [channelFilter, channels, currentUser?.id]);

  const togglePriorityFilter = useCallback((tier: PostTier) => {
    setPriorityFilter((prev) => {
      if (prev.includes(tier)) {
        return prev.filter((t) => t !== tier);
      }
      return [...prev, tier];
    });
  }, []);

  const matchesPriorityFilter = useCallback(
    (p: Post) => {
      if (priorityFilter.length === 0) return true;
      return priorityFilter.includes(p.tier ?? 'everyday');
    },
    [priorityFilter],
  );

  const filteredPosts = useMemo(() => {
    let result = [...posts].filter((p) => p.status === 'ready');

    if (allowedChannelIds !== null) {
      result = result.filter((p) => allowedChannelIds.has(p.channelId));
    }

    // Apply per-channel tier preferences
    const tierPrefs = currentUser?.channelTierPrefs;
    if (tierPrefs) {
      result = result.filter((p) => {
        const prefs = tierPrefs[p.channelId];
        if (!prefs || prefs.length === 0) return true;
        return prefs.includes(p.tier ?? 'everyday');
      });
    }

    // Apply feed-level priority filter
    result = result.filter(matchesPriorityFilter);

    result.sort((a, b) =>
      sortOrder === 'newest'
        ? b.timestamp - a.timestamp
        : a.timestamp - b.timestamp
    );

    return result.slice(0, displayCount);
  }, [posts, allowedChannelIds, sortOrder, displayCount, currentUser?.channelTierPrefs, priorityFilter, matchesPriorityFilter]);

  const hasMore = useMemo(() => {
    const tierPrefs = currentUser?.channelTierPrefs;
    const matchesTier = (p: (typeof posts)[0]) => {
      if (!tierPrefs) return true;
      const prefs = tierPrefs[p.channelId];
      if (!prefs || prefs.length === 0) return true;
      return prefs.includes(p.tier ?? 'everyday');
    };

    const total = posts.filter(
      (p) =>
        p.status === 'ready' &&
        (allowedChannelIds === null || allowedChannelIds.has(p.channelId)) &&
        matchesTier(p) &&
        matchesPriorityFilter(p),
    ).length;
    return displayCount < total;
  }, [posts, allowedChannelIds, displayCount, currentUser?.channelTierPrefs, priorityFilter, matchesPriorityFilter]);

  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayCount((prev) => prev + LOAD_MORE);
    }
  }, [hasMore]);

  const isChannelFiltered =
    channelFilter.mode === 'others' ||
    (channelFilter.mode === 'specific' && channelFilter.specificIds.length > 0);

  const hasActiveFilters = isChannelFiltered || priorityFilter.length > 0;

  const clearFilters = useCallback(() => {
    setChannelFilter({ mode: 'all', specificIds: [] });
    setPriorityFilter([]);
  }, []);

  // When filters or sort order change: scroll to top, reset page, show filtering indicator
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    setDisplayCount(INITIAL_PAGE);
    setIsFiltering(true);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    const timer = setTimeout(() => setIsFiltering(false), FILTERING_INDICATOR_DURATION);
    return () => clearTimeout(timer);
  }, [channelFilter, priorityFilter, sortOrder]);

  // Animated bouncing dots for filter loading indicator
  useEffect(() => {
    if (isFiltering) {
      // Stop any existing animation before starting a new one
      dotLoopRef.current?.stop();
      Animated.timing(filteringOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      const bounceDot = (scale: Animated.Value, delay: number): Animated.CompositeAnimation =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(scale, { toValue: 1.5, duration: 220, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1.0, duration: 220, useNativeDriver: true }),
            Animated.delay(Math.max(0, 560 - delay)),
          ]),
        );
      dotLoopRef.current = Animated.parallel([
        bounceDot(dot1Scale, 0),
        bounceDot(dot2Scale, 160),
        bounceDot(dot3Scale, 320),
      ]);
      dotLoopRef.current.start();
    } else {
      Animated.timing(filteringOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      dotLoopRef.current?.stop();
      dot1Scale.setValue(1);
      dot2Scale.setValue(1);
      dot3Scale.setValue(1);
    }
  }, [isFiltering]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* Initial loading state — show skeletons while posts haven't arrived yet */}
      {!postsLoaded ? (
        <View style={[styles.skeletonList, { paddingTop: headerHeight, paddingBottom: insets.bottom + 150 }]}>
          <SkeletonPostCard />
          <SkeletonPostCard />
          <SkeletonPostCard />
        </View>
      ) : (
        /* Post List — fills the full container; paddingTop reserves space for the absolute header */
        <FlashList
          ref={flatListRef}
          data={filteredPosts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: headerHeight + 12, paddingBottom: insets.bottom + 150 },
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            hasActiveFilters ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
                  No posts match your filters.
                </Text>
                <Button variant="tertiary" size="sm" onPress={clearFilters} style={styles.clearFiltersButton}>
                  Clear Filters
                </Button>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
                  No posts yet. Create your first post!
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            hasMore ? <SkeletonPostCard /> : null
          }
        />
      )}

      {/* Animated filtering dots — just below the sticky header */}
      <Animated.View
        style={[styles.filteringBanner, { top: headerHeight - 2, opacity: filteringOpacity }]}
        pointerEvents="none"
      >
        <Animated.View style={[styles.filteringDot, { backgroundColor: theme.primary, transform: [{ scale: dot1Scale }] }]} />
        <Animated.View style={[styles.filteringDot, { backgroundColor: theme.primary, transform: [{ scale: dot2Scale }] }]} />
        <Animated.View style={[styles.filteringDot, { backgroundColor: theme.primary, transform: [{ scale: dot3Scale }] }]} />
      </Animated.View>

      {/* Animated header — absolute so it slides up without affecting FlashList layout */}
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
                uri={currentUser?.avatarUrl}
                size="sm"
                statusEmoji={isStatusActive(currentUser?.status) ? currentUser?.status?.emoji : undefined}
              />
            </Pressable>
          </View>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.foreground }]}>
              Angelia
            </Text>
          </View>
          <View style={[styles.headerSide, styles.headerSideRight]}>
              <Pressable
                onPress={() => router.push('/(protected)/my-people')}
                style={styles.headerIconBtn}
              >
                <Feather name="users" size={22} color={theme.foreground} />
              </Pressable>
              <Pressable onPress={() => router.push('/(protected)/notifications')}>
                <BellIcon hasNotification={hasPendingActivity} />
              </Pressable>
            </View>
        </View>

        {/* Filters */}
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setChannelFilterOpen(true)}
            style={[
              styles.channelFilterButton,
              {
                borderColor: isChannelFiltered ? theme.primary : theme.border,
                backgroundColor: theme.background,
              },
            ]}
          >
            <Text
              style={[
                styles.channelFilterText,
                { color: isChannelFiltered ? theme.primary : theme.foreground },
              ]}
              numberOfLines={1}
            >
              {channelFilterLabel}
            </Text>
            <Feather
              name="sliders"
              size={15}
              color={isChannelFiltered ? theme.primary : theme.mutedForeground}
            />
          </Pressable>
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

        {/* Priority filter */}
        <View style={styles.priorityFilterRow}>
          <View style={styles.priorityFilterPills}>
            {POST_TIERS.map((opt) => {
              const isActive = priorityFilter.includes(opt.value);
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => togglePriorityFilter(opt.value)}
                  style={[
                    styles.priorityFilterPill,
                    {
                      backgroundColor: isActive
                        ? (opt.badgeBg === 'transparent' ? theme.primary : opt.badgeBg)
                        : theme.muted,
                      borderColor: isActive
                        ? (opt.badgeBg === 'transparent' ? theme.primary : opt.badgeBg)
                        : theme.border,
                    },
                  ]}
                >
                  <Text style={styles.priorityFilterEmoji}>{opt.emoji}</Text>
                  <Text
                    style={[
                      styles.priorityFilterPillText,
                      {
                        color: isActive
                          ? (opt.badgeText === 'transparent' ? theme.primaryForeground : opt.badgeText)
                          : theme.mutedForeground,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Animated.View>

      {/* Channel filter modal */}
      <FeedChannelFilterModal
        isOpen={channelFilterOpen}
        onClose={() => setChannelFilterOpen(false)}
        value={channelFilter}
        onApply={setChannelFilter}
        channels={channels}
        currentUserId={currentUser?.id}
      />

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
          {(() => {
            const statusActive = isStatusActive(currentUser?.status);
            return (
              <Pressable
                style={[
                  styles.fabMenuItem,
                  statusActive
                    ? {
                        backgroundColor: theme.background,
                        borderWidth: 1.5,
                        borderColor: theme.primary,
                      }
                    : { backgroundColor: theme.secondary },
                ]}
                onPress={() => {
                  setFabExpanded(false);
                  setStatusModalOpen(true);
                }}
              >
                {statusActive ? (
                  <Text style={styles.fabStatusEmoji}>
                    {currentUser?.status?.emoji}
                  </Text>
                ) : (
                  <Feather name="smile" size={18} color={theme.secondaryForeground} />
                )}
                <Text
                  style={[
                    styles.fabMenuLabel,
                    {
                      color: statusActive
                        ? theme.foreground
                        : theme.secondaryForeground,
                    },
                  ]}
                >
                  {statusActive
                    ? formatTimeRemaining(currentUser?.status?.expiresAt ?? 0)
                    : 'Status'}
                </Text>
              </Pressable>
            );
          })()}

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: 'auto',
  },
  headerIconBtn: {
    padding: 2,
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
  channelFilterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  channelFilterText: {
    fontSize: 14,
    flex: 1,
  },
  sortButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  priorityFilterPills: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  priorityFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 3,
    flex: 1,
    justifyContent: 'center',
  },
  priorityFilterEmoji: {
    fontSize: 11,
  },
  priorityFilterPillText: {
    fontSize: 11,
    fontWeight: '500',
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
  fabStatusEmoji: {
    fontSize: 18,
    lineHeight: 22,
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
  skeletonList: {
    paddingHorizontal: 16,
  },
  filteringBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
    zIndex: 9,
  },
  filteringDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  clearFiltersButton: {
    marginTop: 4,
  },
});
