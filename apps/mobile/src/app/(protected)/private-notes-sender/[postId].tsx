import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation, type EventArg } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrivateNoteConversationsNotice } from '@/components/PrivateNoteConversationsNotice';
import { PrivateNoteListCard } from '@/components/PrivateNoteListCard';
import { PrivateNoteModal } from '@/components/PrivateNoteModal';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAppSelector } from '@/store/hooks';
import { selectPostById, selectPostAuthor } from '@/store/slices/postsSlice';
import { useTheme } from '@/hooks/useTheme';
import { usePrivateNoteConversationsNotice } from '@/hooks/usePrivateNoteConversationsNotice';
import { usePrivateNoteThreadsForPost } from '@/hooks/usePrivateNoteThreadsForPost';
import { usePrivateNoteUnreadForPost } from '@/hooks/usePrivateNoteUnreadForPost';
import { useSentPrivateNotes } from '@/hooks/useSentPrivateNotes';

/**
 * Screen that shows a visitor (note sender) all private notes they have sent
 * to the post's author. Includes a button to send another note.
 */
export default function PrivateNotesSenderScreen() {
	const { postId } = useLocalSearchParams<{ postId: string }>();
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const navigation = useNavigation();
	const isRoutingToPostRef = React.useRef(false);

	const goToPostDetails = React.useCallback(() => {
		if (!postId) {
			router.replace('/(protected)/feed');
			return;
		}
		isRoutingToPostRef.current = true;
		router.dismissTo({ pathname: '/(protected)/post/[id]', params: { id: postId } });
	}, [postId, router]);

	React.useEffect(() => {
		const unsubscribe = navigation.addListener('beforeRemove', (event: EventArg<'beforeRemove', true, { action: { type: string } }>) => {
			if (isRoutingToPostRef.current) {
				return;
			}
			event.preventDefault();
			goToPostDetails();
		});

		return unsubscribe;
	}, [goToPostDetails, navigation]);

	const post = useAppSelector((state) => selectPostById(state, postId ?? ''));
	const currentUser = useAppSelector((state) => state.users.currentUser);
	const author = useAppSelector((state) =>
		selectPostAuthor(state, post?.authorId ?? ''),
	);

	const isHost = currentUser?.id === post?.authorId;

	const { sentNotes } = useSentPrivateNotes({ postId: isHost ? null : postId });

	const noteIds = useMemo(() => sentNotes.map((note) => note.id), [sentNotes]);
	usePrivateNoteThreadsForPost({ postId, noteIds });

	const { noteIdsWithUnreadReplies } = usePrivateNoteUnreadForPost({
		postId,
		notes: sentNotes,
		currentUserId: currentUser?.id ?? '',
		isHost: false,
	});

	const unreadReplyNoteIds = useMemo(
		() => new Set(noteIdsWithUnreadReplies),
		[noteIdsWithUnreadReplies],
	);

	const [modalVisible, setModalVisible] = useState(false);
	const { showNotice, dismissNotice } = usePrivateNoteConversationsNotice();

	const openNoteThread = React.useCallback((noteId: string) => {
		dismissNotice();
		router.push({
			pathname: '/(protected)/private-note-thread/[postId]/[noteId]',
			params: { postId: postId ?? '', noteId },
		});
	}, [dismissNotice, postId, router]);

	if (!post || !currentUser || isHost) {
		goToPostDetails();
		return null;
	}

	return (
		<View style={{ flex: 1, backgroundColor: theme.background }}>
			<ScreenHeader title='Your Notes' onBack={goToPostDetails} />
			<ScrollView
				style={{ flex: 1, backgroundColor: theme.background }}
				contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
			>
				{showNotice ? <PrivateNoteConversationsNotice onDismiss={dismissNotice} /> : null}
				{sentNotes.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
							No notes sent yet
						</Text>
					</View>
				) : (
					sentNotes.map((note) => {
						return (
							<PrivateNoteListCard
								key={note.id}
								note={note}
								author={currentUser}
								authorLabel='You'
								hasUnreadReply={unreadReplyNoteIds.has(note.id)}
								onPress={() => openNoteThread(note.id)}
							/>
						);
					})
				)}
			</ScrollView>

			<View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border }]}>
				<Pressable
					style={[
						styles.sendButton,
						{ backgroundColor: theme.primary },
					]}
					onPress={() => { setModalVisible(true); }}
				>
					<Feather name='mail' size={16} color={theme.primaryForeground} />
					<Text style={[styles.sendButtonText, { color: theme.primaryForeground }]}>
						Send another note
					</Text>
				</Pressable>
			</View>

			{post.authorId && (
				<PrivateNoteModal
					visible={modalVisible}
					onClose={() => { setModalVisible(false); }}
					postId={post.id}
					postAuthorId={post.authorId}
					authorFirstName={author?.firstName}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: 20,
		paddingTop: 16,
		gap: 12,
	},
	emptyContainer: {
		paddingVertical: 48,
		alignItems: 'center',
	},
	emptyText: {
		fontSize: 15,
		textAlign: 'center',
	},
	footer: {
		paddingHorizontal: 20,
		paddingTop: 12,
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	sendButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		paddingVertical: 13,
		borderRadius: 12,
	},
	sendButtonText: {
		fontSize: 15,
		fontWeight: '600',
	},
});
