import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Animated, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Carousel } from '@/components/ui/Carousel';
import { ReactionDisplay } from '@/components/ReactionDisplay';
import { isStatusActive } from '@/components/NowStatusBadge';
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
import { getRelativeTime } from '@/lib/timeUtils';
import { getColorPair } from '@/lib/channel/channel.utils';
import { getPostAuthorName, getPostExpiryInfo } from '@/lib/post/post.utils';
import { getUserDisplayName } from '@/lib/user/user.utils';
import { COMMON_EMOJIS, PRIVATE_NOTES_SEEN_KEY, CONVERSATION_LAST_SEEN_KEY } from '@/models/constants';
import { EmojiPicker } from '@/components/EmojiPicker';
import { AddReactionIcon } from '@/components/AddReactionIcon';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';
import { ScreenHeader } from '@/components/ScreenHeader';
import { updatePostReactions, removePostReaction } from '@/store/actions/postActions';
import { subscribeToMessages } from '@/services/firebase/firestore';
import type { Reaction, MediaItem } from '@/models/types';

export default function PostDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const dispatch = useAppDispatch();
	const router = useRouter();
	const { theme } = useTheme();
	const { addToast } = useToast();
	const insets = useSafeAreaInsets();
	const post = useAppSelector((state) => selectPostById(state, id || ''));
	const author = useAppSelector((state) => selectPostAuthor(state, post?.authorId || ''));
	const channel = useAppSelector((state) => selectPostChannel(state, post?.channelId || ''));
	const currentUser = useAppSelector((state) => state.users.currentUser);
	const isDemo = useAppSelector((state) => state.demo.isActive);
	const conversationMessages = useAppSelector((state) => selectMessages(state, id || ''));
	const usersMap = useAppSelector(selectAllUsersMapById);
	const { comments: postComments } = usePostComments({ postId: id });

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
	// Tracks whether the host has unseen private notes (persisted in AsyncStorage)
	const [hasUnreadPrivateNotes, setHasUnreadPrivateNotes] = useState(false);
	// Tracks whether there are new conversation messages the user hasn't seen
	const [hasUnreadConversation, setHasUnreadConversation] = useState(false);
	const chatTabScale = useRef(new Animated.Value(1)).current;
	const chatTabUnlockOpacity = useRef(new Animated.Value(0)).current;
	const unlockEmojiY = useRef(new Animated.Value(0)).current;

	// Memoize the latest note timestamp to avoid AsyncStorage reads on every render
	const latestNoteTimestamp = useMemo(
		() => (privateNotes.length > 0 ? Math.max(...privateNotes.map((n) => n.timestamp)) : 0),
		[privateNotes],
	);

	// Memoize the latest non-system message timestamp
	const latestMessageTimestamp = useMemo(
		() => {
			const nonSystem = conversationMessages.filter((m) => { return Boolean(m.isSystem) === false; });
			return nonSystem.length > 0 ? Math.max(...nonSystem.map((m) => m.timestamp)) : 0;
		},
		[conversationMessages],
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
			if (!id || latestMessageTimestamp === 0) {
				setHasUnreadConversation(false);
				return;
			}
			AsyncStorage.getItem(CONVERSATION_LAST_SEEN_KEY(id))
				.then((val) => {
					const lastSeen = val ? Number(val) : 0;
					setHasUnreadConversation(latestMessageTimestamp > lastSeen);
				})
				.catch(() => setHasUnreadConversation(false));
		}, [id, latestMessageTimestamp]),
	);

	const handleCarouselIndexChange = (index: number) => {
		setActiveCarouselIndex(index);
	};

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

	// Group reactions by user
	const reactionGroups = useMemo(() => {
		const groups: Record<string, { emojis: string[]; displayName: string; isCurrentUser: boolean }> = {};
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
	}, [post.reactions, currentUser.id, usersMap]);

	// Filter out emojis the current user has already used
	const availableCommonEmojis = useMemo(() => {
		const myEmojis = new Set(reactionGroups[currentUser.id]?.emojis ?? []);
		return COMMON_EMOJIS.filter((emoji) => !myEmojis.has(emoji));
	}, [reactionGroups, currentUser.id]);

	const triggerTabUnlock = (emoji: string) => {
		setUnlockEmoji(emoji);
		unlockEmojiY.setValue(0);
		chatTabUnlockOpacity.setValue(1);
		chatTabScale.setValue(1);

		Animated.parallel([
			// Float the emoji upward
			Animated.timing(unlockEmojiY, {
				toValue: -30,
				duration: 600,
				useNativeDriver: true,
			}),
			// Bounce the tab
			Animated.sequence([
				Animated.spring(chatTabScale, {
					toValue: 1.06,
					friction: 8,
					tension: 60,
					useNativeDriver: true,
				}),
				Animated.spring(chatTabScale, {
					toValue: 1,
					friction: 8,
					tension: 60,
					useNativeDriver: true,
				}),
			]),
			// Fade out the floating emoji
			Animated.sequence([
				Animated.delay(400),
				Animated.timing(chatTabUnlockOpacity, {
					toValue: 0,
					duration: 200,
					useNativeDriver: true,
				}),
			]),
		]).start(() => setUnlockEmoji(null));
	};

	const handleReaction = async (emoji: string) => {
		// Prevent adding the same reaction twice
		const alreadyReactedWithEmoji = post.reactions.some((r) => r.userId === currentUser.id && r.emoji === emoji);
		if (alreadyReactedWithEmoji) return;

		const wasFirstReaction = !hasReacted;
		const newReaction: Reaction = { emoji, userId: currentUser.id };

		try {
			await dispatch(updatePostReactions({ postId: post.id, newReaction })).unwrap();
		} catch {
			addToast({ type: 'error', title: 'Failed to add reaction' });
		}

		// Unlock the chat tab on first reaction
		if (wasFirstReaction) {
			triggerTabUnlock(emoji);
		}
	};

	const handleRemoveReaction = async (emoji: string) => {
		try {
			await dispatch(removePostReaction({ postId: post.id, emoji, userId: currentUser.id })).unwrap();
		} catch {
			addToast({ type: 'error', title: 'Failed to remove reaction' });
		}
	};

	return (
		<View style={{ flex: 1 }}>
			<ScreenHeader title="Post" />
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
							statusEmoji={isStatusActive(author?.status) ? author?.status?.emoji : undefined}
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
											data.emojis.forEach((emoji) => handleRemoveReaction(emoji));
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

				{/* Host: private notes badge — only when notes exist */}
				{isHost && privateNotes.length > 0 && (
					<Pressable
						style={[styles.privateNotesBadge, { backgroundColor: theme.card, borderColor: theme.border }]}
						onPress={() =>
							router.push({
								pathname: '/(protected)/private-notes-host/[postId]',
								params: { postId: post.id },
							})
						}
					>
						<View style={styles.privateNotesBadgeLeft}>
							<Feather name='mail' size={16} color={theme.primary} />
							{hasUnreadPrivateNotes && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
						</View>
						<Text style={[styles.privateNotesBadgeText, { color: theme.primary }]}>
							{`${privateNotes.length} Private Note${privateNotes.length !== 1 ? 's' : ''}`}
						</Text>
						<Feather name='chevron-right' size={14} color={theme.primary} />
					</Pressable>
				)}

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

			{/* Bottom bar — chat tab + emoji pill */}
			<View style={styles.bottomBarContainer}>
				{/* Chat tab — attached to top of pill */}
				<Animated.View
					style={[
						styles.chatTab,
						{
							backgroundColor: canAccessConversation ? `${theme.primary}12` : theme.card,
							borderColor: canAccessConversation ? theme.primary : theme.border,
							transform: [{ scale: chatTabScale }],
						},
					]}
				>
					<Pressable
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
						style={styles.chatTabInner}
					>
						{!canAccessConversation ? (
							<>
								<Text style={styles.chatTabLockIcon}>🔒</Text>
								<Text style={[styles.chatTabText, { color: theme.mutedForeground }]}>React to join! 👋</Text>
							</>
						) : (
							<>
								<View style={styles.chatTabIconWrapper}>
									<Feather name='message-circle' size={16} color={theme.primary} />
									{hasUnreadConversation && (
										<View style={[styles.unreadDot, { backgroundColor: '#EF4444' }]} />
									)}
								</View>
								<Text style={[styles.chatTabText, { color: theme.primary }]}>
									{messageCount > 0
										? `${messageCount} message${messageCount !== 1 ? 's' : ''}`
										: 'Start the conversation'}
								</Text>
								<Feather name='chevron-right' size={14} color={theme.primary} />
							</>
						)}
					</Pressable>

					{/* Floating unlock emoji overlay */}
					{unlockEmoji != null && (
						<Animated.Text
							style={[
								styles.floatingUnlockEmoji,
								{
									transform: [{ translateY: unlockEmojiY }],
									opacity: chatTabUnlockOpacity,
								},
							]}
							pointerEvents='none'
						>
							{unlockEmoji}
						</Animated.Text>
					)}
				</Animated.View>

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
			</View>

			{/* Visitor: private note trigger — below the emoji pill */}
			{!isHost && (
				<Pressable
					style={[
						styles.privateNoteTrigger,
						{ backgroundColor: theme.card, borderColor: theme.border },
					]}
					onPress={() => setNoteModalVisible(true)}
				>
					<Feather name='mail' size={15} color={theme.mutedForeground} />
					<Text style={[styles.privateNoteTriggerText, { color: theme.mutedForeground }]}>
						or send {author?.firstName ?? 'them'} a private note
					</Text>
				</Pressable>
			)}

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
		borderTopWidth: 0.75,
		borderBottomLeftRadius: 24,
		borderBottomRightRadius: 24,
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
		marginBottom: 8,
	},
	chatTab: {
		borderWidth: 1.5,
		borderBottomWidth: 0,
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		paddingVertical: 10,
		paddingHorizontal: 16,
		position: 'relative',
		overflow: 'visible',
	},
	chatTabInner: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	chatTabIconWrapper: {
		position: 'relative',
	},
	chatTabText: {
		fontSize: 14,
		fontWeight: '600',
	},
	chatTabLockIcon: {
		fontSize: 14,
	},
	floatingUnlockEmoji: {
		position: 'absolute',
		alignSelf: 'center',
		bottom: 4,
		fontSize: 28,
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
	// ── Visitor: private note trigger (below emoji pill) ────────────────────────
	privateNoteTrigger: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		marginHorizontal: 12,
		marginTop: 4,
		marginBottom: 6,
		borderWidth: 1,
		borderRadius: 20,
		paddingVertical: 10,
		paddingHorizontal: 16,
	},
	privateNoteTriggerText: {
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
