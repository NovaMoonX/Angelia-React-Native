import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
	Animated,
	Linking,
	NativeSyntheticEvent,
	NativeScrollEvent,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { BellIcon } from '@/components/BellIcon';
import { PostActivityIcon } from '@/components/PostActivityIcon';
import { PostCard } from '@/components/PostCard';
import { SkeletonPostCard } from '@/components/SkeletonPostCard';
import { isStatusActive } from '@/components/NowStatusBadge';
import { NowStatusModal } from '@/components/NowStatusModal';
import { OnboardingWelcomeModal } from '@/components/OnboardingWelcomeModal';
import { BetaUpdateModal } from '@/components/BetaUpdateModal';
import { AppVersionUpdateModal } from '@/components/AppVersionUpdateModal';
import { AppMessageModal } from '@/components/AppMessageModal';
import { FeedbackFormModal } from '@/components/FeedbackFormModal';
import { FeedChannelFilterModal, type ChannelFilterState } from '@/components/FeedChannelFilterModal';
import { EmojiPicker } from '@/components/EmojiPicker';
import { NewPostsPill, type NewPostsPillRef } from '@/components/NewPostsPill';
import { formatTimeRemaining } from '@/lib/timeUtils';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { updatePostReactions } from '@/store/actions/postActions';
import { saveStatus, clearStatus } from '@/store/actions/userActions';
import { completeTask } from '@/store/actions/taskActions';
import { selectHasAnyPendingActivity } from '@/store/crossSelectors/activitySelectors';
import { selectAllChannels } from '@/store/slices/channelsSlice';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useAutoCompleteTasks } from '@/hooks/useAutoCompleteTasks';
import { useAuthorPostActivity } from '../../hooks/useAuthorPostActivity';
import { useFeedModals } from '@/hooks/useFeedModals';
import {
	BETA_FEEDBACK_FORM_URL,
	FEED_REACTION_HINT_DISMISSED_KEY,
	FEED_REACTION_HINT_USED_KEY,
	POST_TIERS,
} from '@/models/constants';
import type { Post, PostTier, Reaction, UserStatus } from '@/models/types';

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
	const channels = useAppSelector(selectAllChannels);
	const currentUser = useAppSelector((state) => state.users.currentUser);
	const isDemo = useAppSelector((state) => state.demo.isActive);
	const hasPendingActivity = useAppSelector(selectHasAnyPendingActivity);
	const pendingTasks = useAppSelector((state) => state.tasks.items);
	const { hasUnread: hasUnreadPostActivity, refreshSeenState } = useAuthorPostActivity({ enableSubscriptions: true });

	useFocusEffect(
		useCallback(() => {
			void refreshSeenState();
		}, [refreshSeenState]),
	);

	// Auto-complete tasks when their conditions are already met on load.
	// Returns true while auto-completion is in progress to suppress banner flicker.
	const isAutoCompletingTasks = useAutoCompleteTasks();

	// Centralized feed modal priority system.
	const { activeModal, mobileConfig, deviceVersion, targetVersion, closeOnboarding, closeBetaUpdate, closeAppVersion, closeAppMessage, closeFeedbackForm } = useFeedModals();

	const [channelFilter, setChannelFilter] = useState<ChannelFilterState>({ mode: 'all', specificIds: [] });
	const [channelFilterOpen, setChannelFilterOpen] = useState(false);
	const [priorityFilter, setPriorityFilter] = useState<PostTier[]>([]);
	const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
	const [displayCount, setDisplayCount] = useState(INITIAL_PAGE);
	const [fabExpanded, setFabExpanded] = useState(false);
	const [statusModalOpen, setStatusModalOpen] = useState(false);
	const [isFiltering, setIsFiltering] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
	const [reactionTargetPostId, setReactionTargetPostId] = useState<string | null>(null);
	const [showFeedReactionHint, setShowFeedReactionHint] = useState(false);
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

	// Computed animated styles for filtering dots to avoid inline style warnings
	const dot1AnimatedStyle = useMemo(() => ({ transform: [{ scale: dot1Scale }] }), []);
	const dot2AnimatedStyle = useMemo(() => ({ transform: [{ scale: dot2Scale }] }), []);
	const dot3AnimatedStyle = useMemo(() => ({ transform: [{ scale: dot3Scale }] }), []);

	const prevScrollY = useRef(0);
	const headerVisible = useRef(true);
	const headerAnimation = useRef<Animated.CompositeAnimation | null>(null);
	const [scrolledPast, setScrolledPast] = useState(false);

	// Ref to the new-posts pill so onScroll can notify it of the current Y position.
	const newPostsPillRef = useRef<NewPostsPillRef>(null);

	const channelFilterLabel = useMemo(() => {
		if (channelFilter.mode === 'all') return 'All Circles';
		const count = channelFilter.specificIds.length;
		if (count === 0) return 'All Circles';
		if (count === 1) {
			const ch = channels.find((c) => c.id === channelFilter.specificIds[0]);
			return ch?.name ?? '1 Circle';
		}
		return `${count} Circles`;
	}, [channelFilter, channels]);

	// Feed always excludes the current user's circles. "All" means all circles from other people.
	const allowedChannelIds = useMemo((): Set<string> => {
		const otherChannelIds = new Set(
			channels
				.filter((channel) => {
					return channel.ownerId !== currentUser?.id;
				})
				.map((channel) => {
					return channel.id;
				}),
		);

		if (channelFilter.mode === 'all' || channelFilter.specificIds.length === 0) {
			return otherChannelIds;
		}

		return new Set(
			channelFilter.specificIds.filter((id) => {
				return otherChannelIds.has(id);
			}),
		);
	}, [channelFilter.mode, channelFilter.specificIds, channels, currentUser?.id]);

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
		let result = [...posts].filter((p) => {
			return p.status === 'ready';
		});

		if (currentUser) {
			result = result.filter((p) => {
				return p.authorId !== currentUser.id;
			});
		}


		result = result.filter((p) => {
			return allowedChannelIds.has(p.channelId);
		});

		// Apply feed-level priority filter
		result = result.filter(matchesPriorityFilter);

		result.sort((a, b) => (sortOrder === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp));

		return result.slice(0, displayCount);
	}, [posts, currentUser, allowedChannelIds, sortOrder, displayCount, priorityFilter, matchesPriorityFilter]);

	const hasMore = useMemo(() => {
		const total = posts.filter((p) => {
			if (p.status !== 'ready') return false;
			if (currentUser && p.authorId === currentUser.id) return false;
			if (!allowedChannelIds.has(p.channelId)) return false;
			return matchesPriorityFilter(p);
		}).length;
		return displayCount < total;
	}, [posts, currentUser, allowedChannelIds, displayCount, priorityFilter, matchesPriorityFilter]);

	const loadMore = useCallback(() => {
		if (hasMore) {
			setDisplayCount((prev) => prev + LOAD_MORE);
		}
	}, [hasMore]);

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		await refreshSeenState().catch(() => {});
		setIsRefreshing(false);
	}, [refreshSeenState]);

	useEffect(() => {
		const userId = currentUser?.id ?? null;
		if (!userId) {
			setShowFeedReactionHint(false);
			return;
		}
		let isMounted = true;
		void AsyncStorage.multiGet([
			FEED_REACTION_HINT_DISMISSED_KEY(userId),
			FEED_REACTION_HINT_USED_KEY(userId),
		]).then((pairs) => {
			if (!isMounted) return;
			const valuesByKey = new Map(pairs);
			const dismissed = valuesByKey.get(FEED_REACTION_HINT_DISMISSED_KEY(userId)) === 'true';
			const used = valuesByKey.get(FEED_REACTION_HINT_USED_KEY(userId)) === 'true';
			setShowFeedReactionHint(!dismissed && !used);
		}).catch(() => {
			if (!isMounted) return;
			setShowFeedReactionHint(false);
		});
		return () => {
			isMounted = false;
		};
	}, [currentUser?.id]);

	const dismissFeedReactionHint = useCallback(async () => {
		const userId = currentUser?.id ?? null;
		setShowFeedReactionHint(false);
		if (!userId) return;
		await AsyncStorage.setItem(FEED_REACTION_HINT_DISMISSED_KEY(userId), 'true').catch(() => {});
	}, [currentUser?.id]);

	const markFeedReactionHintUsed = useCallback(async () => {
		const userId = currentUser?.id ?? null;
		setShowFeedReactionHint(false);
		if (!userId) return;
		await AsyncStorage.setItem(FEED_REACTION_HINT_USED_KEY(userId), 'true').catch(() => {});
	}, [currentUser?.id]);

	const openFeedReactionPicker = useCallback((postId: string) => {
		setReactionTargetPostId(postId);
		setReactionPickerVisible(true);
	}, []);

	const closeFeedReactionPicker = useCallback(() => {
		setReactionPickerVisible(false);
		setReactionTargetPostId(null);
	}, []);

	const handleFeedReactionSelect = useCallback(async (emoji: string) => {
		const userId = currentUser?.id ?? null;
		const targetPostId = reactionTargetPostId;
		if (!userId || !targetPostId) {
			closeFeedReactionPicker();
			return;
		}
		const targetPost = posts.find((post) => {
			return post.id === targetPostId;
		});
		if (!targetPost) {
			closeFeedReactionPicker();
			addToast({ type: 'error', title: 'That post is no longer available.' });
			return;
		}
		const alreadyReactedWithEmoji = targetPost.reactions.some((reaction) => {
			return reaction.userId === userId && reaction.emoji === emoji;
		});
		closeFeedReactionPicker();
		if (alreadyReactedWithEmoji) return;

		const newReaction: Reaction = {
			emoji,
			userId,
			timestamp: Date.now(),
		};

		try {
			await dispatch(updatePostReactions({ postId: targetPostId, newReaction })).unwrap();
			if (showFeedReactionHint) {
				await markFeedReactionHintUsed();
			}
		} catch {
			addToast({ type: 'error', title: 'Could not add your reaction. Try again.' });
		}
	}, [
		addToast,
		closeFeedReactionPicker,
		currentUser?.id,
		dispatch,
		markFeedReactionHintUsed,
		posts,
		reactionTargetPostId,
		showFeedReactionHint,
	]);

	const isChannelFiltered = channelFilter.mode === 'specific' && channelFilter.specificIds.length > 0;

	const hasActiveFilters = isChannelFiltered || priorityFilter.length > 0;

	const clearFilters = useCallback(() => {
		setChannelFilter({ mode: 'all', specificIds: [] });
		setPriorityFilter([]);
	}, []);

	const handleApplyFilter = useCallback((filter: ChannelFilterState) => {
		setChannelFilter(filter);
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
		[headerTranslateY],
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

			// Notify the new-posts pill of the current scroll position so it can
			// auto-dismiss when the user scrolls back to the top.
			newPostsPillRef.current?.notifyScrollY(currentY);

			setScrolledPast(currentY > 100);
			prevScrollY.current = currentY;
		},
		[animateHeader, headerHeight],
	);

	const handleSaveStatus = useCallback(
		async (status: UserStatus) => {
			// Capture the set_status task ID before dispatching so the closure
			// always has the correct value even if the component re-renders.
			const setStatusTaskId = pendingTasks.find((t) => t.type === 'set_status')?.id ?? null;
			try {
				await dispatch(saveStatus(status)).unwrap();
				addToast({ type: 'success', title: 'Status updated!' });
				setStatusModalOpen(false);

				// Auto-complete the set_status task (if it still exists) and show a
				// congratulatory toast after the action toast has faded away (~4.3s lifecycle).
				if (setStatusTaskId) {
					dispatch(completeTask(setStatusTaskId));
					setTimeout(() => {
						addToast({ type: 'success', title: 'You set your first status! 🎉 Your people can see it.' });
					}, 5000);
				}
			} catch {
				addToast({ type: 'error', title: 'Failed to set status' });
			}
		},
		[dispatch, addToast, pendingTasks],
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

	const handleOpenBetaFeedbackForm = useCallback(async () => {
		const url = mobileConfig?.feedbackForm?.url ?? BETA_FEEDBACK_FORM_URL;
		try {
			await Linking.openURL(url);
		} catch {
			try {
				await Clipboard.setStringAsync(url);
				addToast({ type: 'success', title: 'Could not open link, so we copied it for you.' });
			} catch {
				addToast({ type: 'error', title: 'Could not open or copy the feedback link right now.' });
			}
		}
	}, [mobileConfig, addToast]);

	const renderPost = useCallback(
		({ item }: { item: Post }) => {
			return (
				<PostCard
					post={item}
					onNavigate={() => router.push(`/(protected)/post/${item.id}`)}
					onLongPress={() => openFeedReactionPicker(item.id)}
				/>
			);
		},
		[openFeedReactionPicker, router],
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
					refreshControl={
						<RefreshControl
							refreshing={isRefreshing}
							onRefresh={handleRefresh}
							tintColor={theme.primary}
							colors={[theme.primary]}
						/>
					}
					ListHeaderComponent={
						showFeedReactionHint ? (
							<View style={[styles.feedReactionHintCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
								<View style={styles.feedReactionHintTextWrap}>
									<Text style={[styles.feedReactionHintTitle, { color: theme.foreground }]}>Quick tip ✨</Text>
									<Text style={[styles.feedReactionHintBody, { color: theme.mutedForeground }]}>
										Long-press any post to react right from your feed. Try it once and this tip disappears.
									</Text>
								</View>
								<Pressable onPress={dismissFeedReactionHint} hitSlop={8}>
									<Feather name='x' size={18} color={theme.mutedForeground} />
								</Pressable>
							</View>
						) : null
					}
					ListEmptyComponent={
						hasActiveFilters ? (
							<View style={styles.emptyState}>
								<Text style={styles.emptyEmoji}>🔍</Text>
								<Text style={[styles.emptyText, { color: theme.mutedForeground }]}>No posts match your filters.</Text>
								<Button variant='tertiary' size='sm' onPress={clearFilters} style={styles.clearFiltersButton}>
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
					ListFooterComponent={hasMore ? <SkeletonPostCard /> : null}
				/>
			)}

			{/* Animated filtering dots — just below the sticky header */}
			<Animated.View
				style={[styles.filteringBanner, { top: headerHeight - 2, opacity: filteringOpacity }]}
				pointerEvents='none'
			>
				<Animated.View style={[styles.filteringDot, { backgroundColor: theme.primary }, dot1AnimatedStyle]} />
				<Animated.View style={[styles.filteringDot, { backgroundColor: theme.primary }, dot2AnimatedStyle]} />
				<Animated.View style={[styles.filteringDot, { backgroundColor: theme.primary }, dot3AnimatedStyle]} />
			</Animated.View>

			{/* New-posts pill — always rendered; the component decides its own visibility */}
			<NewPostsPill ref={newPostsPillRef} topOffset={headerHeight + 10} onRequestScrollToTop={scrollToTop} />

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
					<View style={[styles.headerSide, styles.headerSideLeft]}>
						<Pressable onPress={() => router.push('/(protected)/account')}>
							<Avatar user={currentUser} size='sm' />
						</Pressable>
						<Pressable onPress={() => router.push('/(protected)/post-activity')} style={styles.headerIconBtn}>
							<PostActivityIcon hasNotification={hasUnreadPostActivity} />
						</Pressable>
					</View>
					<View style={styles.headerCenter}>
						<Text style={[styles.headerTitle, { color: theme.foreground }]}>Angelia</Text>
					</View>
					<View style={[styles.headerSide, styles.headerSideRight]}>
						<Pressable onPress={() => router.push('/(protected)/my-people')} style={styles.headerIconBtn}>
							<Feather name='users' size={22} color={theme.foreground} />
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
							style={[styles.channelFilterText, { color: isChannelFiltered ? theme.primary : theme.foreground }]}
							numberOfLines={1}
						>
							{channelFilterLabel}
						</Text>
						<Feather name='sliders' size={15} color={isChannelFiltered ? theme.primary : theme.mutedForeground} />
					</Pressable>
					<Pressable
						onPress={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
						style={[styles.sortButton, { borderColor: theme.border }]}
					>
						<Feather name={sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'} size={16} color={theme.foreground} />
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
												? opt.badgeBg === 'transparent'
													? theme.primary
													: opt.badgeBg
												: theme.muted,
											borderColor: isActive
												? opt.badgeBg === 'transparent'
													? theme.primary
													: opt.badgeBg
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
													? opt.badgeText === 'transparent'
														? theme.primaryForeground
														: opt.badgeText
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

				{/* Task banner — lives inside the header so `headerHeight` includes it,
            preventing overlap with both the skeleton list and the filtering dots.
            Hidden while auto-completing tasks to prevent flicker when the count changes. */}
				{pendingTasks.length > 0 && !isAutoCompletingTasks && (
					<Pressable
						onPress={() => router.push('/(protected)/tasks')}
						style={[styles.tasksBanner, { backgroundColor: theme.tertiary }]}
					>
						<Feather name='check-square' size={16} color={theme.tertiaryForeground} />
						<Text style={[styles.tasksBannerText, { color: theme.tertiaryForeground }]}>
							{pendingTasks.length} task{pendingTasks.length !== 1 ? 's' : ''} to do — tap to see
						</Text>
						<Feather name='chevron-right' size={16} color={theme.tertiaryForeground} />
					</Pressable>
				)}
			</Animated.View>

			{/* Channel filter modal */}
			<FeedChannelFilterModal
				isOpen={channelFilterOpen}
				onClose={() => setChannelFilterOpen(false)}
				value={channelFilter}
				onApply={handleApplyFilter}
				channels={channels}
				currentUserId={currentUser?.id}
			/>

			{/* Dim overlay when FAB expanded */}
			{fabExpanded && <Pressable style={styles.overlay} onPress={() => setFabExpanded(false)} />}

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
									<Text style={styles.fabStatusEmoji}>{currentUser?.status?.emoji}</Text>
								) : (
									<Feather name='smile' size={18} color={theme.secondaryForeground} />
								)}
								<Text
									style={[
										styles.fabMenuLabel,
										{
											color: statusActive ? theme.foreground : theme.secondaryForeground,
										},
									]}
								>
									{statusActive ? formatTimeRemaining(currentUser?.status?.expiresAt ?? 0) : 'Status'}
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
						<Feather name='camera' size={18} color={theme.secondaryForeground} />
						<Text style={[styles.fabMenuLabel, { color: theme.secondaryForeground }]}>Camera</Text>
					</Pressable>

					{/* Compose (text post) */}
					<Pressable
						style={[styles.fabMenuItemPrimary, { backgroundColor: theme.primary }]}
						onPress={() => {
							setFabExpanded(false);
							router.push('/(protected)/post/new');
						}}
					>
						<Feather name='edit-2' size={18} color={theme.primaryForeground} />
						<Text style={[styles.fabMenuLabelPrimary, { color: theme.primaryForeground }]}>Compose</Text>
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

			{/* Beta feedback shortcut */}
			{!fabExpanded && (
				<Pressable
					style={[
						styles.quickGuideButton,
						{
							backgroundColor: theme.card,
							borderColor: theme.border,
							bottom: insets.bottom + 76,
						},
					]}
					onPress={() => router.push({ pathname: '/about', params: { from: 'feed' } })}
					accessibilityRole='button'
					accessibilityLabel='How Angelia works'
				>
					<Feather name='help-circle' size={16} color={theme.primary} />
				</Pressable>
			)}

			{/* Beta feedback shortcut */}
			{!fabExpanded && (
				<Pressable
					style={[
						styles.betaFeedbackButton,
						{
							backgroundColor: theme.card,
							borderColor: theme.border,
							bottom: insets.bottom + 24,
						},
					]}
					onPress={handleOpenBetaFeedbackForm}
					accessibilityRole='button'
					accessibilityLabel='Open beta feedback form'
				>
					<Feather name='message-square' size={16} color={theme.primary} />
					<Text style={[styles.betaFeedbackButtonText, { color: theme.foreground }]}>Beta Feedback</Text>
				</Pressable>
			)}

			{/* Scroll to Top FAB — only when feed has posts and user has scrolled past first post */}
			{!fabExpanded && scrolledPast && filteredPosts.length > 0 && (
				<Pressable
					style={[styles.scrollTopFab, { backgroundColor: theme.secondary, bottom: insets.bottom + 90 }]}
					onPress={scrollToTop}
				>
					<Feather name='arrow-up' size={18} color={theme.secondaryForeground} />
				</Pressable>
			)}

			{/* Solid background behind system nav buttons */}
			{insets.bottom > 0 && (
				<View
					style={[
						styles.bottomBar,
						{
							height: insets.bottom,
							backgroundColor: theme.background,
						},
					]}
				/>
			)}

			{/* Status modal */}
			<NowStatusModal
				visible={statusModalOpen}
				onClose={() => setStatusModalOpen(false)}
				onSave={handleSaveStatus}
				onClear={handleClearStatus}
				currentStatus={currentUser?.status}
			/>

			<OnboardingWelcomeModal
				visible={activeModal === 'onboarding'}
				onClose={closeOnboarding}
			/>
			<BetaUpdateModal
				visible={activeModal === 'betaUpdate'}
				onClose={closeBetaUpdate}
			/>
			<AppVersionUpdateModal
				visible={activeModal === 'appVersion'}
				onClose={closeAppVersion}
				mobileConfig={mobileConfig}
				deviceVersion={deviceVersion}
				targetVersion={targetVersion}
			/>
			<AppMessageModal
				visible={activeModal === 'appMessage'}
				onClose={closeAppMessage}
				config={mobileConfig?.broadcastMessage ?? null}
			/>
			<FeedbackFormModal
				visible={activeModal === 'feedbackForm'}
				onClose={closeFeedbackForm}
				config={mobileConfig?.feedbackForm ?? null}
			/>
			<EmojiPicker
				visible={reactionPickerVisible}
				onSelect={handleFeedReactionSelect}
				onClose={closeFeedReactionPicker}
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
		width: 88,
	},
	headerSideLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	headerSideRight: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 14,
		justifyContent: 'flex-end',
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
	feedReactionHintCard: {
		flexDirection: 'row',
		gap: 10,
		alignItems: 'flex-start',
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 10,
		marginBottom: 10,
	},
	feedReactionHintTextWrap: {
		flex: 1,
	},
	feedReactionHintTitle: {
		fontSize: 14,
		fontWeight: '700',
		marginBottom: 2,
	},
	feedReactionHintBody: {
		fontSize: 12,
		lineHeight: 18,
	},
	emptyState: {
		alignItems: 'center',
		paddingTop: 60,
		gap: 12,
	},
	emptyEmoji: {
		fontSize: 48,
	},
	emptyTitle: {
		fontSize: 17,
		fontWeight: '600',
		textAlign: 'center',
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
	betaFeedbackButton: {
		position: 'absolute',
		left: 20,
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 20,
		paddingHorizontal: 12,
		paddingVertical: 10,
		gap: 6,
		elevation: 3,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.14,
		shadowRadius: 2,
		zIndex: 20,
	},
	quickGuideButton: {
		position: 'absolute',
		left: 20,
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		elevation: 3,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.14,
		shadowRadius: 2,
		zIndex: 20,
	},
	betaFeedbackButtonText: {
		fontSize: 13,
		fontWeight: '600',
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
	tasksBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 10,
		gap: 8,
		marginHorizontal: 16,
		marginBottom: 12,
	},
	tasksBannerText: {
		flex: 1,
		fontSize: 13,
		fontWeight: '600',
	},
});
