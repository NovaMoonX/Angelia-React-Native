import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useNavigation, type EventArg, type NavigationAction } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Carousel } from '@/components/ui/Carousel';
import { ReactionDisplay } from '@/components/ReactionDisplay';
import { ReactionPill } from '@/components/ReactionPill';
import { UserProfileModal } from '@/components/UserProfileModal';
import { MediaViewerModal } from '@/components/MediaViewerModal';
import { PrivateNoteModal } from '@/components/PrivateNoteModal';
import { AudioAttachmentPlayer } from '@/components/AudioAttachmentPlayer';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectPostById, selectPostAuthor, selectPostChannel } from '@/store/slices/postsSlice';
import { selectMessages, setMessages } from '@/store/slices/conversationSlice';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { selectChannelsRevision } from '@/store/slices/channelsSlice';
import { ensurePostLeaveSuggestionsLoaded, selectPostLeaveSuggestionsEntry } from '@/store/slices/postLeaveSuggestionsSlice';
import { usePostComments } from '@/hooks/usePostComments';
import { usePrivateNotes } from '@/hooks/usePrivateNotes';
import { usePrivateNoteThreadsForPost } from '@/hooks/usePrivateNoteThreadsForPost';
import { usePrivateNoteUnreadForPost } from '@/hooks/usePrivateNoteUnreadForPost';
import { useSentPrivateNotes } from '@/hooks/useSentPrivateNotes';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useActionModal } from '@/hooks/useActionModal';
import { compareReactionGroupPriority, getSuggestedReactionEmojis } from '@/lib/reaction/reaction.utils';
import { getRelativeTime } from '@/lib/timeUtils';
import { getColorPair } from '@/lib/channel/channel.utils';
import { getPostAuthorName, getPostExpiryInfo } from '@/lib/post/post.utils';
import { getUserDisplayName } from '@/lib/user/user.utils';
import {
	POST_TIERS,
	POST_REACTIONS_SEEN_KEY,
	CONVERSATION_LAST_SEEN_KEY,
	JOIN_CUSTOM_CIRCLE_SUGGESTIONS_SEEN_KEY,
	POST_DETAIL_UNREAD_LEAVE_WARNING_DISABLED_KEY,
} from '@/models/constants';
import { EmojiPicker } from '@/components/EmojiPicker';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';
import { ScreenHeader } from '@/components/ScreenHeader';
import { updatePostReactions, removePostReactionEmojiForUser, deletePostAction } from '@/store/actions/postActions';
import { subscribeToMessages } from '@/services/firebase/firestore';
import { dismissNotificationsByData } from '@/services/notifications';
import { CircleJoinSuggestionsModal } from '@/components/CircleJoinSuggestionsModal';
import { sendJoinRequest } from '@/store/actions/inviteActions';
import type { Reaction, MediaItem, Channel } from '@/models/types';

export default function PostDetailScreen() {
	const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
	const dispatch = useAppDispatch();
	const router = useRouter();
	const navigation = useNavigation();
	const { theme } = useTheme();
	const { addToast } = useToast();
	const { confirm } = useActionModal();
	const insets = useSafeAreaInsets();
	const post = useAppSelector((state) => selectPostById(state, id || ''));
	const author = useAppSelector((state) => selectPostAuthor(state, post?.authorId || ''));
	const channel = useAppSelector((state) => selectPostChannel(state, post?.channelId || ''));
	const currentUser = useAppSelector((state) => state.users.currentUser);
	const isDemo = useAppSelector((state) => state.demo.isActive);
	const channelRevision = useAppSelector(selectChannelsRevision);
	const conversationMessages = useAppSelector((state) => selectMessages(state, id || ''));
	const usersMap = useAppSelector(selectAllUsersMapById);
	const outgoingJoinRequests = useAppSelector((state) => state.invites.outgoing);
	const { comments: postComments } = usePostComments({ postId: id });
	const currentUserId = currentUser?.id ?? '';

	// Determine host role before hook calls (hooks must be unconditional)
	const isHost = currentUser?.id === post?.authorId;
	const { notes: privateNotes } = usePrivateNotes({
		postId: isHost ? id : null,
		hostId: isHost ? post?.authorId : null,
	});
	const { sentNotes } = useSentPrivateNotes({ postId: isHost ? null : id });
	const relevantPrivateNotes = isHost ? privateNotes : sentNotes;
	const relevantNoteIds = useMemo(() => {
		return relevantPrivateNotes.map((note) => note.id);
	}, [relevantPrivateNotes]);

	usePrivateNoteThreadsForPost({ postId: id, noteIds: relevantNoteIds });

	const {
		hasUnreadNotes: hasUnreadPrivateNotes,
		hasUnreadReplies: hasUnreadPrivateNoteReplies,
		hasUnreadActivity: hasUnreadPrivateNoteActivity,
	} = usePrivateNoteUnreadForPost({
		postId: id,
		notes: relevantPrivateNotes,
		currentUserId,
		isHost,
	});

	const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
	const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
	const [profileModalOpen, setProfileModalOpen] = useState(false);
	const [mediaViewer, setMediaViewer] = useState<{ url: string; type: 'image' | 'video' | 'audio'; caption: string | null; title: string | null } | null>(null);
	const [unlockEmoji, setUnlockEmoji] = useState<string | null>(null);
	const [noteModalVisible, setNoteModalVisible] = useState(false);
	const [seenCircleSuggestionIds, setSeenCircleSuggestionIds] = useState<string[]>([]);
	const [circleSuggestionsVisible, setCircleSuggestionsVisible] = useState(false);
	const [requestingChannelId, setRequestingChannelId] = useState<string | null>(null);
	const isRoutingAwayRef = useRef(false);
	// Tracks whether there are new conversation messages the user hasn't seen
	const [hasUnreadConversation, setHasUnreadConversation] = useState(false);
	const [showUnreadLeaveModal, setShowUnreadLeaveModal] = useState(false);
	const [disableUnreadLeaveWarning, setDisableUnreadLeaveWarning] = useState(false);
	const suggestionsEntry = useAppSelector((state) => {
		return selectPostLeaveSuggestionsEntry(state, currentUser?.id ?? '', author?.id ?? '');
	});
	const suggestionsStatus = suggestionsEntry?.status ?? 'idle';
	const suggestionChannels = suggestionsEntry?.channels ?? [];

	const unreadItems = [
		hasUnreadPrivateNoteActivity ? 'new private note activity' : null,
		hasUnreadConversation ? 'new messages' : null,
	].filter((item): item is string => {
		return item != null;
	});
	const hasUnreadAuthorActivity = unreadItems.length > 0;
	const unreadItemsCopy = unreadItems.join(' and ');
	const shouldWarnBeforeLeaving = isHost && !disableUnreadLeaveWarning && hasUnreadAuthorActivity;
	const shouldReturnToPostActivity = from === 'post-activity';

	// Used by the header back button — does NOT set isRoutingAwayRef so beforeRemove can intercept.
	const handleHeaderBack = useCallback(() => {
		if (shouldReturnToPostActivity) {
			router.back();
			return;
		}
		router.dismissTo('/(protected)/feed');
	}, [router, shouldReturnToPostActivity]);

	// Called after the user has finished interacting with a blocking modal (suggestions, unread warning).
	// Sets the ref so beforeRemove lets it through without intercepting again.
	const goToExitDestination = useCallback(() => {
		isRoutingAwayRef.current = true;
		handleHeaderBack();
	}, [handleHeaderBack]);

	// Only count inbound messages for unread state; your own messages should never mark unread.
	const latestIncomingMessageTimestamp = useMemo(
		() => {
			const incoming = conversationMessages.filter((m) => {
				return Boolean(m.isSystem) === false && m.authorId !== currentUserId;
			});
			return incoming.length > 0 ? Math.max(...incoming.map((m) => m.timestamp)) : 0;
		},
		[conversationMessages, currentUserId],
	);

	// For authored posts, DataListenerWrapper owns the global messages listener.
	// Keep this local subscription only for non-host contexts.
	useEffect(() => {
		if (!id || isDemo || isHost) return;
		const unsub = subscribeToMessages(id, (msgs) => {
			dispatch(setMessages({ postId: id, messages: msgs }));
		});
		return unsub;
	}, [id, dispatch, isDemo, isHost]);

	// Reactions are only marked seen after visiting post detail (not from the post-activity card).
	// Clear reaction unread when the user leaves this screen (not immediately on open).
	// Private notes and conversation unread state are owned by their detail screens.
	useFocusEffect(
		useCallback(() => {
			if (!currentUser?.id || !id) return undefined;

			// Viewing this post means post-targeted push cards are now stale.
			void dismissNotificationsByData({ type: 'new_post', postId: id }).catch(() => {});
			void dismissNotificationsByData({ type: 'post_reaction', postId: id }).catch(() => {});

			return () => {
				const seenAt = String(Date.now());
				void AsyncStorage.setItem(POST_REACTIONS_SEEN_KEY(currentUser.id, id), seenAt).catch(() => {});
				// Dismiss reaction notifications for this specific post.
				void dismissNotificationsByData({ type: 'post_reaction', postId: id }).catch(() => {});
			};
		}, [currentUser?.id, id]),
	);

	useEffect(() => {
		if (!currentUser?.id) {
			setDisableUnreadLeaveWarning(false);
			setSeenCircleSuggestionIds([]);
			return;
		}
		AsyncStorage.getItem(POST_DETAIL_UNREAD_LEAVE_WARNING_DISABLED_KEY(currentUser.id))
			.then((val) => {
				setDisableUnreadLeaveWarning(val === 'true');
			})
			.catch(() => {
				setDisableUnreadLeaveWarning(false);
			});
	}, [currentUser?.id]);

	useEffect(() => {
		if (!currentUser?.id) {
			setSeenCircleSuggestionIds([]);
			return;
		}
		const seenKey = JOIN_CUSTOM_CIRCLE_SUGGESTIONS_SEEN_KEY(currentUser.id);
		AsyncStorage.getItem(seenKey)
			.then((raw) => {
				if (!raw) {
					setSeenCircleSuggestionIds([]);
					return;
				}
				try {
					const parsed = JSON.parse(raw) as unknown;
					if (!Array.isArray(parsed)) {
						setSeenCircleSuggestionIds([]);
						return;
					}
					setSeenCircleSuggestionIds(parsed.filter((v): v is string => { return typeof v === 'string'; }));
				} catch {
					setSeenCircleSuggestionIds([]);
				}
			})
			.catch(() => {
				setSeenCircleSuggestionIds([]);
			});
	}, [currentUser?.id]);

	// Re-check conversation unread dot on focus (clears after the user visits conversation screen)
	useFocusEffect(
		useCallback(() => {
			if (!id || latestIncomingMessageTimestamp === 0) {
				setHasUnreadConversation(false);
				return;
			}
			AsyncStorage.getItem(CONVERSATION_LAST_SEEN_KEY(id))
				.then((val) => {
					const lastSeen = val ? Number(val) : 0;
					setHasUnreadConversation(latestIncomingMessageTimestamp > lastSeen);
				})
				.catch(() => setHasUnreadConversation(false));
		}, [id, latestIncomingMessageTimestamp]),
	);

	const handleCarouselIndexChange = (index: number) => {
		setActiveCarouselIndex(index);
	};

	// Group reactions by emoji, sorted by count, oldest reaction, then emoji strength.
	const reactionGroups = useMemo(() => {
		if (!post || !currentUser) return [] as { emoji: string; count: number; currentUserReacted: boolean; names: string[] }[];
		const groups: Record<string, { count: number; oldestTimestamp: number; currentUserReacted: boolean; names: string[] }> = {};
		post.reactions.forEach((r) => {
			const timestamp = typeof r.timestamp === 'number' ? r.timestamp : 0;
			if (!groups[r.emoji]) {
				groups[r.emoji] = {
					count: 0,
					oldestTimestamp: timestamp,
					currentUserReacted: false,
					names: [],
				};
			}
			groups[r.emoji].count += 1;
			if (timestamp < groups[r.emoji].oldestTimestamp) {
				groups[r.emoji].oldestTimestamp = timestamp;
			}
			if (r.userId === currentUser.id) {
				groups[r.emoji].currentUserReacted = true;
				groups[r.emoji].names.unshift('You');
			} else {
				const reactingUser = usersMap[r.userId];
				groups[r.emoji].names.push(getUserDisplayName(reactingUser, currentUser.id, r.userId, 'first-last-initial'));
			}
		});
		return Object.entries(groups)
			.map(([emoji, data]) => {
				return {
					emoji,
					count: data.count,
					oldestTimestamp: data.oldestTimestamp,
					currentUserReacted: data.currentUserReacted,
					names: data.names,
				};
			})
			.sort((a, b) => {
				return compareReactionGroupPriority(
					{ emoji: a.emoji, count: a.count, oldestTimestamp: a.oldestTimestamp },
					{ emoji: b.emoji, count: b.count, oldestTimestamp: b.oldestTimestamp },
				);
			})
			.map((group) => {
				return {
					emoji: group.emoji,
					count: group.count,
					currentUserReacted: group.currentUserReacted,
					names: group.names,
				};
			});
	}, [post, currentUser, usersMap]);

	const suggestedReactionEmojis = useMemo(() => {
		if (!post || !currentUser) {
			return [];
		}
		return getSuggestedReactionEmojis({
			reactions: post.reactions,
			currentUserId: currentUser.id,
			max: 12,
		});
	}, [post, currentUser]);

	const circleSuggestions = useMemo(() => {
		const seenIdSet = new Set(seenCircleSuggestionIds);
		return suggestionChannels
			.filter((circle) => {
				if (seenIdSet.has(circle.id)) {
					return false;
				}
				return true;
			})
			.map((circle) => {
				const isRequested = outgoingJoinRequests.some((request) => {
					return request.channelId === circle.id && request.status === 'pending';
				});
				return {
					channel: circle,
					isRequested,
				};
			});
	}, [outgoingJoinRequests, seenCircleSuggestionIds, suggestionChannels]);

	// All useCallback/useEffect hooks must be before the early return — Rules of Hooks

	const handleDeletePost = useCallback(async () => {
		const ok = await confirm({
			title: 'Delete post?',
			message: 'This will permanently delete your post and cannot be undone.',
			destructive: true,
		});
		if (!ok) return;

		try {
			await dispatch(deletePostAction({ postId: post?.id ?? '' })).unwrap();
			addToast({ type: 'success', title: 'Post deleted' });
			goToExitDestination();
		} catch (err) {
			addToast({
				type: 'error',
				title: err instanceof Error ? err.message : 'Failed to delete post',
			});
		}
	}, [post?.id, dispatch, addToast, confirm, goToExitDestination]);

	const markCircleSuggestionsSeen = useCallback(async (channelIds: string[]) => {
		if (!currentUser || channelIds.length === 0) return;
		const seenKey = JOIN_CUSTOM_CIRCLE_SUGGESTIONS_SEEN_KEY(currentUser.id);
		const existingSeen = seenCircleSuggestionIds;
		const mergedSeen = Array.from(new Set([...existingSeen, ...channelIds]));
		setSeenCircleSuggestionIds(mergedSeen);
		await AsyncStorage.setItem(seenKey, JSON.stringify(mergedSeen)).catch(() => {});
	}, [currentUser, seenCircleSuggestionIds]);

	useEffect(() => {
		if (!id || isDemo || !currentUser || !author || !channel || !post) return;
		if (currentUser.id === author.id) return;
		if (channel.isDaily !== true) return;
		const reactedToPost = post.reactions.some((reaction) => {
			return reaction.userId === currentUser.id;
		});
		if (!reactedToPost) return;
		void dispatch(
			ensurePostLeaveSuggestionsLoaded({
				viewerId: currentUser.id,
				authorId: author.id,
				sourceRevision: channelRevision,
			}),
		);
	}, [author, channel, channelRevision, currentUser, dispatch, id, isDemo, post]);

	useEffect(() => {
		const unsubscribe = navigation.addListener('beforeRemove', (event: EventArg<'beforeRemove', true, { action: NavigationAction }>) => {
			// Let programmatic navigations (post-modal) pass through
			if (isRoutingAwayRef.current) return;

			// Block while unread-leave warning is visible, or trigger it
			if (shouldWarnBeforeLeaving && !showUnreadLeaveModal) {
				event.preventDefault();
				setShowUnreadLeaveModal(true);
				return;
			}
			if (showUnreadLeaveModal) { event.preventDefault(); return; }

			// Block while suggestions modal is open
			if (circleSuggestionsVisible) { event.preventDefault(); return; }

			// Show suggestions modal if ready
			if (suggestionsStatus === 'success' && circleSuggestions.length > 0) {
				event.preventDefault();
				setCircleSuggestionsVisible(true);
				return;
			}
			// Nothing to block — let navigation proceed
		});

		return unsubscribe;
	}, [
		circleSuggestions.length,
		circleSuggestionsVisible,
		navigation,
		suggestionsStatus,
		shouldWarnBeforeLeaving,
		showUnreadLeaveModal,
	]);

	const closeUnreadLeaveModal = useCallback(() => {
		setShowUnreadLeaveModal(false);
	}, []);

	const leavePostAnyway = useCallback(() => {
		setShowUnreadLeaveModal(false);
		goToExitDestination();
	}, [goToExitDestination]);

	const disableWarningAndLeave = useCallback(async () => {
		if (currentUser?.id) {
			await AsyncStorage.setItem(
				POST_DETAIL_UNREAD_LEAVE_WARNING_DISABLED_KEY(currentUser.id),
				'true',
			).catch(() => {});
			setDisableUnreadLeaveWarning(true);
		}
		leavePostAnyway();
	}, [currentUser?.id, leavePostAnyway]);

	const handleRequestJoinFromSuggestion = useCallback(
		async (suggestedChannel: Channel) => {
			if (!currentUser) return;
			setRequestingChannelId(suggestedChannel.id);
			try {
				await dispatch(
					sendJoinRequest({
						channelId: suggestedChannel.id,
						inviteCode: suggestedChannel.inviteCode ?? '',
						channelOwnerId: suggestedChannel.ownerId,
						message: '',
					}),
				).unwrap();
				await markCircleSuggestionsSeen([suggestedChannel.id]);
				addToast({ type: 'success', title: 'Join request sent!' });
			} catch (err) {
				addToast({
					type: 'error',
					title: err instanceof Error ? err.message : 'Failed to send join request',
				});
			} finally {
				setRequestingChannelId(null);
			}
		},
		[addToast, currentUser, dispatch, markCircleSuggestionsSeen],
	);

	const handleNotInterested = useCallback(
		async (channelId: string) => {
			await markCircleSuggestionsSeen([channelId]);
		},
		[markCircleSuggestionsSeen],
	);

	const closeSuggestionModalAndLeave = useCallback(async () => {
		const remainingIds = circleSuggestions.map((item) => { return item.channel.id; });
		await markCircleSuggestionsSeen(remainingIds);
		setCircleSuggestionsVisible(false);
		goToExitDestination();
	}, [circleSuggestions, goToExitDestination, markCircleSuggestionsSeen]);

	const stayOnPage = useCallback(() => {
		setCircleSuggestionsVisible(false);
	}, []);

	// Auto-close and navigate away when all suggestions have been acted upon
	useEffect(() => {
		if (circleSuggestionsVisible && circleSuggestions.length === 0) {
			void closeSuggestionModalAndLeave();
		}
	}, [circleSuggestions.length, circleSuggestionsVisible, closeSuggestionModalAndLeave]);

	if (!post || !currentUser) {
		return (
			<View style={[styles.centered, { backgroundColor: theme.background }]}>
				<Text style={[styles.deletedPostTitle, { color: theme.foreground }]}>This post is not available</Text>
				<Text style={[styles.deletedPostBody, { color: theme.mutedForeground }]}>
					It may have been deleted by the author.
				</Text>
				<Button
					variant='outline'
					onPress={() => {
						goToExitDestination();
					}}
				>
					Back to Feed
				</Button>
			</View>
		);
	}

	const colors = channel ? getColorPair(channel) : { backgroundColor: '#6366F1', textColor: '#FFF' };
	const channelBadgeLabel = channel?.isDaily ? 'Daily' : channel?.name;
	const tierBadgeConfig = post.tier ? POST_TIERS.find((t) => { return t.value === post.tier; }) ?? null : null;
	const showTierBadge = tierBadgeConfig != null && post.tier !== 'everyday';
	const authorName = getPostAuthorName(author, currentUser);
	const hasReacted = post.reactions.some((r) => r.userId === currentUser.id);
	const canAccessConversation = hasReacted || isHost;
	const expiryInfo = channel != null
		? getPostExpiryInfo(post.timestamp, channel.isDaily === true)
		: null;

	// Use conversation messages count, falling back to post comments
	const messageCount = conversationMessages.filter((m) => Boolean(m.isSystem) === false).length || postComments.length;
	const showHostPrivateNotesAction = isHost && privateNotes.length > 0;
	const unreadHighlightBorderColor = '#D4A017';
	const privateNoteHighlightActive = hasUnreadPrivateNoteActivity;
	const hostPrivateNotesBorderColor = privateNoteHighlightActive
		? unreadHighlightBorderColor
		: theme.border;
	const hostPrivateNotesTextColor = privateNoteHighlightActive
		? unreadHighlightBorderColor
		: theme.mutedForeground;

	const visitorSentNotesLabel = (() => {
		const base = `Your ${sentNotes.length} note${sentNotes.length !== 1 ? 's' : ''}`;
		if (hasUnreadPrivateNoteReplies) {
			return `${base} · New reply`;
		}
		return base;
	})();

	const handleReaction = async (emoji: string) => {
		// Prevent adding the same reaction twice
		const alreadyReactedWithEmoji = post.reactions.some((r) => r.userId === currentUser.id && r.emoji === emoji);
		if (alreadyReactedWithEmoji) return;
		const newReaction: Reaction = { emoji, userId: currentUser.id, timestamp: Date.now() };

		try {
			await dispatch(updatePostReactions({ postId: post.id, newReaction })).unwrap();
		} catch {
			addToast({ type: 'error', title: 'Failed to add reaction' });
		}
	};

	const handleReactionGroupPress = async (group: { emoji: string; currentUserReacted: boolean }) => {
		void Haptics.selectionAsync().catch(() => {});
		if (group.currentUserReacted) {
			await handleRemoveSingleEmojiReaction(group.emoji);
			return;
		}
		await handleReaction(group.emoji);
	};

	const handleRemoveSingleEmojiReaction = async (emoji: string) => {
		try {
			await dispatch(removePostReactionEmojiForUser({ postId: post.id, userId: currentUser.id, emoji })).unwrap();
		} catch {
			addToast({ type: 'error', title: 'Failed to remove reaction' });
		}
	};

	return (
		<View style={{ flex: 1 }}>
			<ScreenHeader
			title="Post"
			onBack={handleHeaderBack}
			rightAction={
				isHost ? (
					<View style={styles.headerActions}>
						<Pressable
							onPress={() => {
								router.push({ pathname: '/(protected)/post/new', params: { editPostId: post.id } });
							}}
							hitSlop={8}
							style={styles.headerActionButton}
						>
							<Feather name='edit-3' size={20} color={theme.foreground} />
						</Pressable>
						<Pressable onPress={handleDeletePost} hitSlop={8} style={styles.headerActionButton}>
							<Feather name='trash-2' size={20} color='#EF4444' />
						</Pressable>
					</View>
				) : undefined
			}
		/>
			<KeyboardAvoidingView
				style={{ flex: 1 }}
				behavior={KEYBOARD_BEHAVIOR}
				keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
			>
			<ScrollView
				style={{ flex: 1, backgroundColor: theme.background }}
				contentContainerStyle={[
					styles.content,
					{
						paddingTop: 0,
						paddingBottom: insets.bottom + 160,
					},
				]}
				keyboardShouldPersistTaps='handled'
			>
				{showTierBadge && tierBadgeConfig && (
					<View style={[styles.priorityBanner, { backgroundColor: tierBadgeConfig.badgeBg }]}> 
						<Text style={styles.priorityBannerEmoji}>{tierBadgeConfig.emoji}</Text>
						<Text style={[styles.priorityBannerText, { color: tierBadgeConfig.badgeText }]}> 
							{tierBadgeConfig.label}
						</Text>
					</View>
				)}

				{/* Post Header */}
				<View style={styles.header}>
					<Pressable
						onPress={
							author && currentUser && author.id !== currentUser.id ? () => setProfileModalOpen(true) : undefined
						}
					>
						<Avatar
							user={author}
							size='md'
						/>
					</Pressable>
					<View style={styles.headerText}>
						<Text style={[styles.authorName, { color: theme.foreground }]}>{authorName}</Text>
						<View style={styles.headerMeta}>
							<Text style={[styles.timestamp, { color: theme.mutedForeground }]}>
								{getRelativeTime(post.timestamp)}
							</Text>
							{isHost && post.lastEditedAt != null && (
								<Text style={[styles.editedTimestamp, { color: theme.mutedForeground }]}>
									{`Last edited: ${new Date(post.lastEditedAt).toLocaleString()}`}
								</Text>
							)}
							{expiryInfo != null && (
								<Text style={styles.expiryBadge}>
									{expiryInfo.daysLeft === 0 ? '⏳ Going away today' : `⏳ ${expiryInfo.daysLeft}d left`}
								</Text>
							)}
						</View>
					</View>
					<View style={styles.badgesColumn}>
						{channel && (
							<Badge
								style={{
									backgroundColor: colors.backgroundColor,
									borderColor: colors.backgroundColor,
								}}
								textStyle={{ color: colors.textColor }}
							>
								{channelBadgeLabel}
							</Badge>
						)}
					</View>
				</View>

				{/* Post Content */}
				{post.text ? <Text selectable={true} style={[styles.postText, { color: theme.foreground }]}>{post.text}</Text> : null}

				{/* Media */}
				{post.media && post.media.length > 0 ? (
					post.media.length === 1 ? (
						<MediaCard
							item={post.media[0]}
							style={styles.singleMedia}
							isActive
							onOpen={() => setMediaViewer({ url: post.media![0].url, type: post.media![0].type, caption: post.media![0].caption ?? null, title: post.media![0].title ?? null })}
						/>
					) : (
						<Carousel style={{ borderRadius: 12 }} onIndexChange={handleCarouselIndexChange}>
							{post.media.map((item, index) => (
								<MediaCard
									key={`media-${index}`}
									item={item}
									style={styles.carouselMedia}
									isActive={index === activeCarouselIndex}
									onOpen={() => setMediaViewer({ url: item.url, type: item.type, caption: item.caption ?? null, title: item.title ?? null })}
								/>
							))}
						</Carousel>
					)
				) : null}

				{/* Reactions — inline Slack-like layout */}
				<View style={styles.reactionsSection}>
					{reactionGroups.length > 0 ? (
						<View style={styles.reactionGroups}>
							{reactionGroups.map((group) => (
								<ReactionDisplay
									key={group.emoji}
									emoji={group.emoji}
									count={group.count}
									names={group.names}
									currentUserReacted={group.currentUserReacted}
									onClick={() => {
										void handleReactionGroupPress(group);
									}}
								/>
							))}
						</View>
					) : (
						<View style={styles.emptyReactionsContainer}>
							<Text style={[styles.emptyReactionsText, { color: theme.mutedForeground }]}>
								{isHost
									? 'No reactions just yet!'
									: 'No reactions yet — be the first to react! 🎉'}
							</Text>
						</View>
					)}
				</View>

				{/* Visitor: sent notes badge — navigates to sender notes screen */}
				{!isHost && sentNotes.length > 0 && (
					<Pressable
						style={[
							styles.sentNotesBadge,
							{
								backgroundColor: theme.card,
								borderColor: privateNoteHighlightActive
									? unreadHighlightBorderColor
									: theme.border,
							},
						]}
						onPress={() =>
							router.push({
								pathname: '/(protected)/private-notes-sender/[postId]',
								params: { postId: post.id },
							})
						}
					>
						<View style={styles.secondaryActionIconWrap}>
							<Feather
								name='mail'
								size={16}
								color={privateNoteHighlightActive ? unreadHighlightBorderColor : theme.mutedForeground}
							/>
							{hasUnreadPrivateNoteActivity && (
								<View style={[styles.unreadDot, { backgroundColor: '#EF4444' }]} />
							)}
						</View>
						<Text
							style={[
								styles.sentNotesBadgeText,
								{
									color: privateNoteHighlightActive
										? unreadHighlightBorderColor
										: theme.mutedForeground,
								},
							]}
						>
							{visitorSentNotesLabel}
						</Text>
						<Feather
							name='chevron-right'
							size={14}
							color={privateNoteHighlightActive ? unreadHighlightBorderColor : theme.mutedForeground}
						/>
					</Pressable>
				)}
			</ScrollView>

			{/* Bottom bar — emoji pill + discreet actions */}
			<View style={styles.bottomBarContainer}>
				<ReactionPill
					emojis={suggestedReactionEmojis}
					onSelect={(emoji) => {
						void handleReaction(emoji);
					}}
					onOpenPicker={() => setEmojiPickerVisible(true)}
					highlighted={hasReacted}
				/>

				<View style={styles.secondaryActionsRow}>
					{!isHost && (
						<Pressable
							style={[
								styles.secondaryAction,
								{ backgroundColor: theme.card, borderColor: theme.border },
							]}
							onPress={() => setNoteModalVisible(true)}
						>
							<View style={styles.secondaryActionContent}>
								<Feather name='mail' size={15} color={theme.mutedForeground} />
								<Text style={[styles.secondaryActionText, { color: theme.mutedForeground }]}>Private Note</Text>
							</View>
						</Pressable>
					)}

					{showHostPrivateNotesAction && (
						<Pressable
							style={[
								styles.secondaryAction,
								{ backgroundColor: theme.card, borderColor: hostPrivateNotesBorderColor },
							]}
							onPress={() =>
								router.push({
									pathname: '/(protected)/private-notes-host/[postId]',
									params: { postId: post.id },
								})
							}
						>
							<View style={styles.secondaryActionContent}>
								<View style={styles.secondaryActionIconWrap}>
									<Feather name='mail' size={15} color={hostPrivateNotesTextColor} />
									{hasUnreadPrivateNoteActivity && (
										<View style={[styles.unreadDot, { backgroundColor: '#EF4444' }]} />
									)}
								</View>
								<Text
									style={[styles.secondaryActionText, { color: hostPrivateNotesTextColor }]}
									numberOfLines={1}
								>
									{`Private Notes (${privateNotes.length})`}
								</Text>
							</View>
						</Pressable>
					)}

					<Pressable
						style={[
							styles.secondaryAction,
							{
								backgroundColor: theme.card,
								borderColor: theme.border,
								opacity: canAccessConversation ? 1 : 0.55,
							},
						]}
						onPress={
							canAccessConversation
								? () =>
										router.push({
											pathname: '/(protected)/conversation',
											params: { postId: post.id },
										})
								: undefined
						}
						disabled={!canAccessConversation}
					>
						<View style={styles.secondaryActionContent}>
							<View style={styles.secondaryActionIconWrap}>
								<Feather
									name={canAccessConversation ? 'message-circle' : 'lock'}
									size={15}
									color={theme.mutedForeground}
								/>
								{canAccessConversation && hasUnreadConversation && (
									<View style={[styles.unreadDot, { backgroundColor: '#EF4444' }]} />
								)}
							</View>
							<Text style={[styles.secondaryActionText, { color: theme.mutedForeground }]}>
								{canAccessConversation && messageCount > 0
									? `${messageCount} message${messageCount !== 1 ? 's' : ''}`
									: 'Conversation'}
							</Text>
						</View>
					</Pressable>

	
				</View>
			</View>

			<CircleJoinSuggestionsModal
				isOpen={circleSuggestionsVisible}
				authorName={author?.firstName ?? 'their'}
				items={circleSuggestions}
				requestingChannelId={requestingChannelId}
				onRequestJoin={handleRequestJoinFromSuggestion}
				onNotInterested={handleNotInterested}
				onLeavePage={closeSuggestionModalAndLeave}
				onStayHere={stayOnPage}
			/>

			<EmojiPicker
				visible={emojiPickerVisible}
				onSelect={(emoji) => {
					handleReaction(emoji);
					setEmojiPickerVisible(false);
				}}
				onClose={() => setEmojiPickerVisible(false)}
			/>

			{!isHost && post.authorId && (
				<PrivateNoteModal
					visible={noteModalVisible}
					onClose={() => setNoteModalVisible(false)}
					postId={post.id}
					postAuthorId={post.authorId}
					authorFirstName={author?.firstName}
				/>
			)}

			<UserProfileModal visible={profileModalOpen} onClose={() => setProfileModalOpen(false)} user={author} />

			<Modal
				visible={showUnreadLeaveModal}
				transparent
				animationType='fade'
				onRequestClose={closeUnreadLeaveModal}
			>
				<View style={styles.unreadLeaveModalOverlay}>
					<Pressable style={StyleSheet.absoluteFill} onPress={closeUnreadLeaveModal} />
					<View style={[styles.unreadLeaveModalCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
						<Text style={[styles.unreadLeaveModalTitle, { color: theme.foreground }]}>Before you leave…</Text>
						<Text style={[styles.unreadLeaveModalBody, { color: theme.mutedForeground }]}> 
							You still have {unreadItemsCopy} marked with the red indicator dot on this post.
						</Text>
						<Text style={[styles.unreadLeaveModalBody, { color: theme.mutedForeground }]}> 
							Stay here to review them now, or exit this post anyway.
						</Text>
						<View style={styles.unreadLeaveModalActions}>
							<Button variant='outline' onPress={closeUnreadLeaveModal}>Look at now</Button>
							<Button variant='secondary' onPress={leavePostAnyway}>Exit Post Anyway</Button>
							<Pressable style={styles.unreadLeaveDontShowWrap} onPress={() => { void disableWarningAndLeave(); }} hitSlop={8}>
								<Text style={[styles.unreadLeaveDontShowText, { color: theme.mutedForeground }]}>Don't show this again</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>

			{/* Solid background behind system nav buttons */}
			{insets.bottom > 0 && (
				<View
					style={{
						height: insets.bottom,
						backgroundColor: theme.background,
					}}
				/>
			)}

			{/* Full-screen media viewer */}
			{mediaViewer && (
				<MediaViewerModal
					uri={mediaViewer.url}
					mediaType={mediaViewer.type}
					caption={mediaViewer.caption}
					title={mediaViewer.title}
					visible
					onClose={() => setMediaViewer(null)}
				/>
			)}
		</KeyboardAvoidingView>
		</View>
	);
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: 20,
		paddingBottom: 20,
	},
	centered: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 20,
		gap: 10,
	},
	deletedPostTitle: {
		fontSize: 18,
		fontWeight: '700',
		textAlign: 'center',
	},
	deletedPostBody: {
		fontSize: 14,
		textAlign: 'center',
		lineHeight: 20,
		marginBottom: 4,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 12,
		marginBottom: 16,
	},
	headerText: {
		flex: 1,
		marginLeft: 12,
	},
	headerMeta: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		flexWrap: 'wrap',
	},
	headerActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 20,
	},
	headerActionButton: {
		paddingHorizontal: 2,
	},
	priorityBanner: {
		marginTop: 0,
		marginHorizontal: -20,
		marginBottom: 12,
		paddingVertical: 6,
		paddingHorizontal: 20,
		borderRadius: 0,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
	},
	priorityBannerEmoji: {
		fontSize: 13,
	},
	priorityBannerText: {
		fontSize: 12,
		fontWeight: '600',
		letterSpacing: 0.2,
		textAlign: 'center',
	},
	badgesColumn: {
		alignItems: 'flex-end',
		gap: 6,
	},
	authorName: {
		fontSize: 16,
		fontWeight: '600',
	},
	timestamp: {
		fontSize: 13,
	},
	editedTimestamp: {
		fontSize: 12,
		fontWeight: '500',
	},
	expiryBadge: {
		fontSize: 12,
		color: '#92400E',
		fontWeight: '500',
	},
	postText: {
		fontSize: 15,
		lineHeight: 22,
		marginBottom: 16,
	},
	singleMedia: {
		width: '100%',
		height: 250,
		borderRadius: 12,
		overflow: 'hidden',
		marginBottom: 16,
	},
	carouselMedia: {
		width: '100%',
		height: 250,
		overflow: 'hidden',
	},
	audioContainer: {
		position: 'relative',
		backgroundColor: '#0F172A',
		alignItems: 'center',
		justifyContent: 'flex-start',
		paddingTop: 14,
		paddingBottom: 8,
	},
	audioPlayerWrap: {
		width: '94%',
	},
	videoContainer: {
		backgroundColor: '#1a1a1a',
	},
	videoPlaceholder: {
		...StyleSheet.absoluteFillObject,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(0,0,0,0.45)',
		gap: 6,
	},
	videoPlaceholderOverlay: {
		backgroundColor: 'rgba(0,0,0,0.35)',
	},
	watchVideoText: {
		color: '#FFF',
		fontSize: 14,
		fontWeight: '700',
		letterSpacing: 0.5,
	},
	captionBadge: {
		position: 'absolute',
		bottom: 6,
		right: 6,
		backgroundColor: 'rgba(0,0,0,0.6)',
		borderRadius: 10,
		width: 22,
		height: 22,
		alignItems: 'center',
		justifyContent: 'center',
	},
	reactionsSection: {
		marginTop: 16,
	},
	reactionGroups: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	bottomBarContainer: {
		marginHorizontal: 12,
		marginBottom: 6,
	},
	emptyReactionsContainer: {
		paddingVertical: 32,
		paddingHorizontal: 16,
		alignItems: 'center',
	},
	emptyReactionsText: {
		fontSize: 15,
		textAlign: 'center',
		lineHeight: 22,
	},
	privateNotesBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 20,
		borderWidth: 1,
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 14,
	},
	privateNotesBadgeLeft: {
		position: 'relative',
	},
	unreadDot: {
		position: 'absolute',
		top: -3,
		right: -3,
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	privateNotesBadgeText: {
		flex: 1,
		fontSize: 14,
		fontWeight: '500',
	},
	// ── Visitor: sent notes badge (in scroll area) ───────────────────────────────
	sentNotesBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 20,
		borderWidth: 1,
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 14,
	},
	sentNotesBadgeText: {
		flex: 1,
		fontSize: 14,
		fontWeight: '500',
	},
	secondaryActionsRow: {
		flexDirection: 'row',
		gap: 8,
		marginTop: 8,
	},
	secondaryAction: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderRadius: 999,
		paddingVertical: 11,
		paddingHorizontal: 12,
	},
	secondaryActionContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	unreadLeaveModalOverlay: {
		...StyleSheet.absoluteFillObject,
		justifyContent: 'center',
		paddingHorizontal: 20,
		backgroundColor: 'rgba(0,0,0,0.45)',
	},
	unreadLeaveModalCard: {
		borderWidth: 1,
		borderRadius: 16,
		paddingHorizontal: 16,
		paddingVertical: 14,
		gap: 8,
	},
	unreadLeaveModalTitle: {
		fontSize: 18,
		fontWeight: '700',
	},
	unreadLeaveModalBody: {
		fontSize: 14,
		lineHeight: 20,
	},
	unreadLeaveModalActions: {
		marginTop: 4,
		gap: 8,
	},
	unreadLeaveDontShowWrap: {
		marginTop: 10,
	},
	unreadLeaveDontShowText: {
		textAlign: 'center',
		fontSize: 13,
		fontWeight: '500',
		textDecorationLine: 'underline',
	},
	secondaryActionIconWrap: {
		position: 'relative',
		width: 18,
		alignItems: 'center',
	},
	secondaryActionText: {
		fontSize: 14,
		fontWeight: '500',
	},
});

// ── MediaCard ────────────────────────────────────────────────────────────────

function MediaCard({ item, style, isActive = true, onOpen }: { item: MediaItem; style: object; isActive?: boolean; onOpen: () => void }) {
	if (item.type === 'audio') {
		return (
			<Pressable style={[style, styles.audioContainer]} onPress={onOpen}>
				<View style={styles.audioPlayerWrap}>
					<AudioAttachmentPlayer uri={item.url} title={item.title} isActive={isActive} variant='full' />
				</View>
				{!!item.caption && (
					<View style={styles.captionBadge}>
						<Feather name='file-text' size={10} color='#FFF' />
					</View>
				)}
			</Pressable>
		);
	}

	if (item.type === 'video') {
		return (
			<Pressable style={[style, styles.videoContainer]} onPress={onOpen}>
				{item.thumbnailUrl ? (
					<Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit='cover' />
				) : null}
				<View style={[styles.videoPlaceholder, item.thumbnailUrl && styles.videoPlaceholderOverlay]}>
					<Feather name='play-circle' size={48} color='#FFF' />
					{!item.thumbnailUrl && <Text style={styles.watchVideoText}>Watch Video</Text>}
				</View>
				{!!item.caption && (
					<View style={styles.captionBadge}>
						<Feather name='file-text' size={10} color='#FFF' />
					</View>
				)}
			</Pressable>
		);
	}

	return (
		<Pressable onPress={onOpen} style={{ position: 'relative' }}>
			<Image source={{ uri: item.url }} style={style} contentFit='cover' />
			{!!item.caption && (
				<View style={styles.captionBadge}>
					<Feather name='file-text' size={10} color='#FFF' />
				</View>
			)}
		</Pressable>
	);
}
