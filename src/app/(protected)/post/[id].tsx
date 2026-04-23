import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Animated, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Carousel } from '@/components/ui/Carousel';
import { ReactionDisplay } from '@/components/ReactionDisplay';
import { isStatusActive } from '@/components/NowStatusBadge';
import { UserProfileModal } from '@/components/UserProfileModal';
import { MediaViewerModal } from '@/components/MediaViewerModal';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectPostById, selectPostAuthor, selectPostChannel } from '@/store/slices/postsSlice';
import { selectMessages } from '@/store/slices/conversationSlice';
import { usePostComments } from '@/hooks/usePostComments';
import { usePrivateNotes } from '@/hooks/usePrivateNotes';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { getRelativeTime } from '@/lib/timeUtils';
import { getColorPair } from '@/lib/channel/channel.utils';
import { getPostAuthorName, getPostExpiryInfo } from '@/lib/post/post.utils';
import { COMMON_EMOJIS } from '@/models/constants';
import { EmojiPicker } from '@/components/EmojiPicker';
import { AddReactionIcon } from '@/components/AddReactionIcon';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';
import { updatePostReactions, removePostReaction } from '@/store/actions/postActions';
import { sendPrivateNote } from '@/store/actions/privateNoteActions';
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
	const { comments: postComments } = usePostComments({ postId: id });

	// Determine host role before hook calls (hooks must be unconditional)
	const isHost = currentUser?.id === post?.authorId;
	const { notes: privateNotes } = usePrivateNotes({
		postId: isHost ? id : null,
		hostId: isHost ? post?.authorId : null,
	});

	const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
	const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
	const [profileModalOpen, setProfileModalOpen] = useState(false);
	const [mediaViewer, setMediaViewer] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
	const [unlockEmoji, setUnlockEmoji] = useState<string | null>(null);
	const [privateNoteText, setPrivateNoteText] = useState('');
	const [sendingNote, setSendingNote] = useState(false);
	const chatTabScale = useRef(new Animated.Value(1)).current;
	const chatTabUnlockOpacity = useRef(new Animated.Value(0)).current;
	const unlockEmojiY = useRef(new Animated.Value(0)).current;

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
	const authorName = getPostAuthorName(author, currentUser);
	const hasReacted = post.reactions.some((r) => r.userId === currentUser.id);
	const expiryInfo = channel != null
		? getPostExpiryInfo(post.timestamp, channel.isDaily === true)
		: null;

	// Use conversation messages count, falling back to post comments
	const messageCount = conversationMessages.filter((m) => Boolean(m.isSystem) === false).length || postComments.length;

	// Group reactions by emoji
	const reactionGroups = useMemo(() => {
		const groups: Record<string, { count: number; isUserReacted: boolean }> = {};
		post.reactions.forEach((r) => {
			if (!groups[r.emoji]) {
				groups[r.emoji] = { count: 0, isUserReacted: false };
			}
			groups[r.emoji].count++;
			if (r.userId === currentUser.id) {
				groups[r.emoji].isUserReacted = true;
			}
		});
		return groups;
	}, [post.reactions, currentUser.id]);

	// Filter out emojis the user has already reacted with
	const availableCommonEmojis = useMemo(() => {
		return COMMON_EMOJIS.filter((emoji) => !reactionGroups[emoji]?.isUserReacted);
	}, [reactionGroups]);

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

	const handleSendPrivateNote = async () => {
		if (!privateNoteText.trim() || !post.authorId) return;
		setSendingNote(true);
		try {
			await dispatch(
				sendPrivateNote({ postId: post.id, hostId: post.authorId, text: privateNoteText }),
			).unwrap();
			setPrivateNoteText('');
			addToast({ type: 'success', title: 'Note sent! 💌' });
		} catch {
			addToast({ type: 'error', title: 'Failed to send note' });
		} finally {
			setSendingNote(false);
		}
	};

	return (
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
						paddingBottom: insets.bottom + 80,
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
							preset={author?.avatar || 'moon'}
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
							{channel.name}
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
							{Object.entries(reactionGroups).map(([emoji, data]) => (
								<ReactionDisplay
									key={emoji}
									emoji={emoji}
									count={data.count}
									isUserReacted={data.isUserReacted}
									onClick={() => (data.isUserReacted ? handleRemoveReaction(emoji) : handleReaction(emoji))}
								/>
							))}
						</View>
					) : (
						<View style={styles.emptyReactionsContainer}>
							<Text style={[styles.emptyReactionsText, { color: theme.mutedForeground }]}>
								No reactions yet — be the first to react! 🎉
							</Text>
						</View>
					)}
				</View>

				{/* Private Notes — host sees badge, visitors see send form */}
				{isHost ? (
					<Pressable
						style={[styles.privateNotesBadge, { backgroundColor: theme.card, borderColor: theme.border }]}
						onPress={() =>
							router.push({
								pathname: '/(protected)/private-notes/[postId]',
								params: { postId: post.id },
							})
						}
					>
						<Feather name='mail' size={16} color={theme.mutedForeground} />
						<Text style={[styles.privateNotesBadgeText, { color: theme.mutedForeground }]}>
							{privateNotes.length > 0
								? `${privateNotes.length} Private Note${privateNotes.length !== 1 ? 's' : ''}`
								: 'No private notes yet'}
						</Text>
						<Feather name='chevron-right' size={14} color={theme.mutedForeground} />
					</Pressable>
				) : (
					<View style={[styles.privateNoteSection, { borderColor: theme.border }]}>
						<Text style={[styles.privateNoteNudge, { color: theme.mutedForeground }]}>
							Want to tell {author?.firstName ?? 'them'} something just between you two? 💌
						</Text>
						<View style={styles.privateNoteInputRow}>
							<TextInput
								style={[
									styles.privateNoteInput,
									{
										backgroundColor: theme.card,
										borderColor: theme.border,
										color: theme.foreground,
									},
								]}
								placeholder='Write a private note…'
								placeholderTextColor={theme.mutedForeground}
								value={privateNoteText}
								onChangeText={setPrivateNoteText}
								multiline
								maxLength={500}
								editable={!sendingNote}
							/>
							<Pressable
								style={[
									styles.privateNoteSendButton,
									{
										backgroundColor:
											privateNoteText.trim() && !sendingNote
												? theme.primary
												: theme.border,
									},
								]}
								onPress={handleSendPrivateNote}
								disabled={!privateNoteText.trim() || sendingNote}
							>
								<Feather name='send' size={18} color='#FFF' />
							</Pressable>
						</View>
					</View>
				)}
			</ScrollView>

			{/* Bottom bar — chat tab + emoji pill */}
			<View style={styles.bottomBarContainer}>
				{/* Chat tab — attached to top of pill */}
				<Animated.View
					style={[
						styles.chatTab,
						{
							backgroundColor: hasReacted ? `${theme.primary}12` : theme.card,
							borderColor: hasReacted ? theme.primary : theme.border,
							transform: [{ scale: chatTabScale }],
						},
					]}
				>
					<Pressable
						onPress={
							hasReacted
								? () =>
										router.push({
											pathname: '/(protected)/conversation',
											params: { postId: post.id },
										})
								: undefined
						}
						disabled={!hasReacted}
						style={styles.chatTabInner}
					>
						{!hasReacted ? (
							<>
								<Text style={styles.chatTabLockIcon}>🔒</Text>
								<Text style={[styles.chatTabText, { color: theme.mutedForeground }]}>React to join! 👋</Text>
							</>
						) : (
							<>
								<Feather name='message-circle' size={16} color={theme.primary} />
								<Text style={[styles.chatTabText, { color: theme.primary }]}>
									{messageCount > 0
										? `${messageCount} message${messageCount !== 1 ? 's' : ''}`
										: 'Start the conversation 💬'}
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

			<EmojiPicker
				visible={emojiPickerVisible}
				onSelect={(emoji) => {
					handleReaction(emoji);
					setEmojiPickerVisible(false);
				}}
				onClose={() => setEmojiPickerVisible(false)}
			/>

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
	privateNotesBadgeText: {
		flex: 1,
		fontSize: 14,
		fontWeight: '500',
	},
	privateNoteSection: {
		marginTop: 20,
		borderTopWidth: 1,
		paddingTop: 16,
		gap: 10,
	},
	privateNoteNudge: {
		fontSize: 13,
		lineHeight: 18,
	},
	privateNoteInputRow: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 10,
	},
	privateNoteInput: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 10,
		fontSize: 14,
		lineHeight: 20,
		minHeight: 44,
		maxHeight: 120,
	},
	privateNoteSendButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		justifyContent: 'center',
		alignItems: 'center',
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
