import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Carousel } from '@/components/ui/Carousel';
import { ReactionDisplay } from '@/components/ReactionDisplay';
import { UserProfileModal } from '@/components/UserProfileModal';
import { MediaViewerModal } from '@/components/MediaViewerModal';
import { PrivateNoteModal } from '@/components/PrivateNoteModal';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectPostById, selectPostAuthor, selectPostChannel } from '@/store/slices/postsSlice';
import { selectMessages, setMessages } from '@/store/slices/conversationSlice';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { usePostComments } from '@/hooks/usePostComments';
import { usePrivateNotes } from '@/hooks/usePrivateNotes';
import { useSentPrivateNotes } from '@/hooks/useSentPrivateNotes';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useActionModal } from '@/hooks/useActionModal';
import { getRelativeTime } from '@/lib/timeUtils';
import { getColorPair } from '@/lib/channel/channel.utils';
import { getPostAuthorName, getPostExpiryInfo } from '@/lib/post/post.utils';
import { getUserDisplayName } from '@/lib/user/user.utils';
import {
	COMMON_EMOJIS,
	POST_ACTIVITY_SEEN_KEY,
	PRIVATE_NOTES_SEEN_KEY,
	CONVERSATION_LAST_SEEN_KEY,
	JOIN_CUSTOM_CIRCLE_SUGGESTIONS_SEEN_KEY,
} from '@/models/constants';
import { EmojiPicker } from '@/components/EmojiPicker';
import { AddReactionIcon } from '@/components/AddReactionIcon';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';
import { ScreenHeader } from '@/components/ScreenHeader';
import { updatePostReactions, removeAllPostReactionsForUser, deletePostAction } from '@/store/actions/postActions';
import { getActiveCustomChannelsByOwner, subscribeToMessages } from '@/services/firebase/firestore';
import { CircleJoinSuggestionsModal, type CircleJoinSuggestionItem } from '@/components/CircleJoinSuggestionsModal';
import { sendJoinRequest } from '@/store/actions/inviteActions';
import type { Reaction, MediaItem, Channel } from '@/models/types';

export default function PostDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
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

	const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
	const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
	const [profileModalOpen, setProfileModalOpen] = useState(false);
	const [mediaViewer, setMediaViewer] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
	const [unlockEmoji, setUnlockEmoji] = useState<string | null>(null);
	const [noteModalVisible, setNoteModalVisible] = useState(false);
	const [circleSuggestions, setCircleSuggestions] = useState<CircleJoinSuggestionItem[]>([]);
	const [circleSuggestionsVisible, setCircleSuggestionsVisible] = useState(false);
	const [circleSuggestionsLoading, setCircleSuggestionsLoading] = useState(false);
	const [requestingChannelId, setRequestingChannelId] = useState<string | null>(null);
	const pendingNavigationActionRef = useRef<any>(null);
	// Tracks whether the host has unseen private notes (persisted in AsyncStorage)
	const [hasUnreadPrivateNotes, setHasUnreadPrivateNotes] = useState(false);
	// Tracks whether there are new conversation messages the user hasn't seen
	const [hasUnreadConversation, setHasUnreadConversation] = useState(false);
	const seenCircleSuggestionIdsRef = useRef<string[]>([]);

	// Memoize the latest note timestamp to avoid AsyncStorage reads on every render
	const latestNoteTimestamp = useMemo(
		() => (privateNotes.length > 0 ? Math.max(...privateNotes.map((n) => n.timestamp)) : 0),
		[privateNotes],
	);

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

	// Subscribe to conversation messages so the unread indicator works without
	// the user needing to open the conversation screen first
	useEffect(() => {
		if (!id || isDemo) return;
		const unsub = subscribeToMessages(id, (msgs) => {
			dispatch(setMessages({ postId: id, messages: msgs }));
		});
		return unsub;
	}, [id, dispatch, isDemo]);

	// Re-check the unread dot every time this screen comes into focus (e.g. after
	// returning from the private-notes-host screen, where PRIVATE_NOTES_SEEN_KEY
	// gets written). Using useFocusEffect ensures the dot clears on return.
	useFocusEffect(
		useCallback(() => {
			if (!currentUser?.id) return;
			void AsyncStorage.setItem(POST_ACTIVITY_SEEN_KEY(currentUser.id), String(Date.now())).catch(() => {});
		}, [currentUser?.id]),
	);

	useFocusEffect(
		useCallback(() => {
			if (!isHost || !id || latestNoteTimestamp === 0) {
				setHasUnreadPrivateNotes(false);
				return;
			}
			AsyncStorage.getItem(PRIVATE_NOTES_SEEN_KEY(id))
				.then((val) => {
					const lastSeen = val ? Number(val) : 0;
					setHasUnreadPrivateNotes(latestNoteTimestamp > lastSeen);
				})
				.catch(() => setHasUnreadPrivateNotes(false));
		}, [isHost, id, latestNoteTimestamp]),
	);

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

	// Group reactions by user — must be before early return to satisfy Rules of Hooks
	const reactionGroups = useMemo(() => {
		const groups: Record<string, { emojis: string[]; displayName: string; isCurrentUser: boolean }> = {};
		if (!post || !currentUser) return groups;
		post.reactions.forEach((r) => {
			if (!groups[r.userId]) {
				const reactingUser = usersMap[r.userId];
				groups[r.userId] = {
					emojis: [],
					displayName: getUserDisplayName(reactingUser, currentUser.id, r.userId),
					isCurrentUser: r.userId === currentUser.id,
				};
			}
			groups[r.userId].emojis.push(r.emoji);
		});
		return groups;
	}, [post, currentUser, usersMap]);

	// Filter out emojis the current user has already used — must be before early return
	const availableCommonEmojis = useMemo(() => {
		if (!currentUser) return COMMON_EMOJIS;
		const myEmojis = new Set(reactionGroups[currentUser.id]?.emojis ?? []);
		return COMMON_EMOJIS.filter((emoji) => { return !myEmojis.has(emoji); });
	}, [reactionGroups, currentUser]);

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
			if (router.canGoBack()) {
				router.back();
			} else {
				router.replace('/(protected)/feed');
			}
		} catch (err) {
			addToast({
				type: 'error',
				title: err instanceof Error ? err.message : 'Failed to delete post',
			});
		}
	}, [post?.id, dispatch, addToast, router, confirm]);

	const markCircleSuggestionsSeen = useCallback(async (channelIds: string[]) => {
		if (!currentUser || channelIds.length === 0) return;
		const seenKey = JOIN_CUSTOM_CIRCLE_SUGGESTIONS_SEEN_KEY(currentUser.id);
		const existingSeen = seenCircleSuggestionIdsRef.current;
		const mergedSeen = Array.from(new Set([...existingSeen, ...channelIds]));
		seenCircleSuggestionIdsRef.current = mergedSeen;
		await AsyncStorage.setItem(seenKey, JSON.stringify(mergedSeen)).catch(() => {});
	}, [currentUser]);

	useEffect(() => {
		if (!currentUser || !author || !channel || !post) {
			setCircleSuggestions([]);
			return;
		}
		if (currentUser.id === author.id || channel.isDaily !== true) {
			setCircleSuggestions([]);
			return;
		}

		const reacted = post.reactions.some((r) => {
			return r.userId === currentUser.id;
		});
		if (!reacted) {
			setCircleSuggestions([]);
			return;
		}

		setCircleSuggestionsLoading(true);
		const seenKey = JOIN_CUSTOM_CIRCLE_SUGGESTIONS_SEEN_KEY(currentUser.id);
		void AsyncStorage.getItem(seenKey)
			.then((raw) => {
				if (!raw) {
					seenCircleSuggestionIdsRef.current = [];
					return;
				}
				try {
					const parsed = JSON.parse(raw) as unknown;
					seenCircleSuggestionIdsRef.current = Array.isArray(parsed)
						? parsed.filter((v): v is string => { return typeof v === 'string'; })
						: [];
				} catch {
					seenCircleSuggestionIdsRef.current = [];
				}
			})
			.catch(() => {
				seenCircleSuggestionIdsRef.current = [];
			})
			.finally(async () => {
				const ownerCustomCircles = await getActiveCustomChannelsByOwner(author.id).catch(() => {
					return [];
				});
				const filtered = ownerCustomCircles.filter((circle) => {
					return (
						Boolean(circle.inviteCode) &&
						circle.ownerId !== currentUser.id &&
						!circle.subscribers.includes(currentUser.id) &&
						!seenCircleSuggestionIdsRef.current.includes(circle.id)
					);
				});
				setCircleSuggestions(
					filtered.map((circle) => {
						const isRequested = outgoingJoinRequests.some((request) => {
							return request.channelId === circle.id && request.status === 'pending';
						});
						return {
							channel: circle,
							isRequested,
						};
					}),
				);
				setCircleSuggestionsLoading(false);
			});
	}, [author, channel, currentUser, post, outgoingJoinRequests]);

	useEffect(() => {
		const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
			if (circleSuggestionsVisible) return;
			if (circleSuggestionsLoading || circleSuggestions.length === 0) return;
			event.preventDefault();
			pendingNavigationActionRef.current = event.data.action;
			setCircleSuggestionsVisible(true);
		});

		return unsubscribe;
	}, [circleSuggestions.length, circleSuggestionsLoading, circleSuggestionsVisible, navigation]);

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
				setCircleSuggestions((prev) => {
					return prev.filter((item) => { return item.channel.id !== suggestedChannel.id; });
				});
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
			setCircleSuggestions((prev) => {
				return prev.filter((item) => { return item.channel.id !== channelId; });
			});
			await markCircleSuggestionsSeen([channelId]);
		},
		[markCircleSuggestionsSeen],
	);

	const closeSuggestionModalAndLeave = useCallback(async () => {
		const remainingIds = circleSuggestions.map((item) => { return item.channel.id; });
		await markCircleSuggestionsSeen(remainingIds);
		setCircleSuggestionsVisible(false);
		const action = pendingNavigationActionRef.current;
		pendingNavigationActionRef.current = null;
		if (action) {
			navigation.dispatch(action);
		}
	}, [circleSuggestions, markCircleSuggestionsSeen, navigation]);

	const stayOnPage = useCallback(() => {
		setCircleSuggestionsVisible(false);
		pendingNavigationActionRef.current = null;
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
				<Text style={{ color: theme.mutedForeground }}>Post not found</Text>
			</View>
		);
	}

	const colors = channel ? getColorPair(channel) : { backgroundColor: '#6366F1', textColor: '#FFF' };
	const channelBadgeLabel = channel?.isDaily ? 'Daily' : channel?.name;
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
	const hostPrivateNotesBorderColor = isHost && hasUnreadPrivateNotes
		? unreadHighlightBorderColor
		: theme.border;
	const hostPrivateNotesTextColor = isHost && hasUnreadPrivateNotes
		? unreadHighlightBorderColor
		: theme.mutedForeground;

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

	const handleRemoveAllReactions = async () => {
		try {
			await dispatch(removeAllPostReactionsForUser({ postId: post.id, userId: currentUser.id })).unwrap();
		} catch {
			addToast({ type: 'error', title: 'Failed to remove reactions' });
		}
	};

	return (
		<View style={{ flex: 1 }}>
			<ScreenHeader
			title="Post"
			rightAction={
				isHost ? (
					<Pressable onPress={handleDeletePost} hitSlop={8}>
						<Feather name='trash-2' size={20} color='#EF4444' />
					</Pressable>
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
							{expiryInfo != null && (
								<Text style={styles.expiryBadge}>
									{expiryInfo.daysLeft === 0 ? '⏳ Going away today' : `⏳ ${expiryInfo.daysLeft}d left`}
								</Text>
							)}
						</View>
					</View>
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

				{/* Post Content */}
				{post.text ? <Text style={[styles.postText, { color: theme.foreground }]}>{post.text}</Text> : null}

				{/* Media */}
				{post.media && post.media.length > 0 ? (
					post.media.length === 1 ? (
						<MediaCard
							item={post.media[0]}
							style={styles.singleMedia}
							onOpen={() => setMediaViewer({ url: post.media![0].url, type: post.media![0].type })}
						/>
					) : (
						<Carousel style={{ borderRadius: 12 }} onIndexChange={handleCarouselIndexChange}>
							{post.media.map((item, index) => (
								<MediaCard
									key={`media-${index}`}
									item={item}
									style={styles.carouselMedia}
									onOpen={() => setMediaViewer({ url: item.url, type: item.type })}
								/>
							))}
						</Carousel>
					)
				) : null}

				{/* Reactions — inline Slack-like layout */}
				<View style={styles.reactionsSection}>
					{Object.keys(reactionGroups).length > 0 ? (
						<View style={styles.reactionGroups}>
							{Object.entries(reactionGroups).map(([userId, data]) => (
								<ReactionDisplay
									key={userId}
									emojis={data.emojis}
									displayName={data.displayName}
									isCurrentUser={data.isCurrentUser}
									onClick={() => {
										if (data.isCurrentUser) {
											handleRemoveAllReactions();
										}
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
						style={[styles.sentNotesBadge, { backgroundColor: theme.card, borderColor: theme.border }]}
						onPress={() =>
							router.push({
								pathname: '/(protected)/private-notes-sender/[postId]',
								params: { postId: post.id },
							})
						}
					>
						<Feather name='mail' size={16} color={theme.mutedForeground} />
						<Text style={[styles.sentNotesBadgeText, { color: theme.mutedForeground }]}>
							{`Your ${sentNotes.length} note${sentNotes.length !== 1 ? 's' : ''}`}
						</Text>
						<Feather name='chevron-right' size={14} color={theme.mutedForeground} />
					</Pressable>
				)}
			</ScrollView>

			{/* Bottom bar — emoji pill + discreet actions */}
			<View style={styles.bottomBarContainer}>
				{/* Emoji pill */}
				<View
					style={[
						styles.fixedEmojiBar,
						{
							borderColor: hasReacted ? theme.primary : theme.border,
							backgroundColor: theme.background,
						},
					]}
				>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.fixedEmojiBarContent}
					>
						{availableCommonEmojis.map((emoji) => (
							<Pressable key={emoji} onPress={() => handleReaction(emoji)} style={styles.emojiButton}>
								<Text style={styles.emojiText}>{emoji}</Text>
							</Pressable>
						))}
						<Pressable
							onPress={() => setEmojiPickerVisible(true)}
							style={[styles.emojiButton, { borderColor: theme.border }]}
						>
							<AddReactionIcon size={28} color={theme.mutedForeground} />
						</Pressable>
					</ScrollView>
				</View>

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
									{hasUnreadPrivateNotes && <View style={[styles.unreadDot, { backgroundColor: '#EF4444' }]} />}
								</View>
								<Text style={[styles.secondaryActionText, { color: hostPrivateNotesTextColor }]}>Private Notes</Text>
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
	authorName: {
		fontSize: 16,
		fontWeight: '600',
	},
	timestamp: {
		fontSize: 13,
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
	emojiButton: {
		width: 44,
		height: 44,
		borderRadius: 8,
		justifyContent: 'center',
		alignItems: 'center',
	},
	emojiText: {
		fontSize: 24,
	},
	fixedEmojiBar: {
		borderWidth: 1.5,
		borderTopWidth: 1.5,
		borderRadius: 24,
		paddingHorizontal: 8,
		paddingVertical: 4,
	},
	fixedEmojiBarContent: {
		flexGrow: 1,
		gap: 6,
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

function MediaCard({ item, style, onOpen }: { item: MediaItem; style: object; onOpen: () => void }) {
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
			</Pressable>
		);
	}

	return (
		<Pressable onPress={onOpen}>
			<Image source={{ uri: item.url }} style={style} contentFit='cover' />
		</Pressable>
	);
}
