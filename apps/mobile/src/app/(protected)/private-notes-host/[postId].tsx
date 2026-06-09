import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation, type EventArg } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrivateNoteConversationsNotice } from '@/components/PrivateNoteConversationsNotice';
import { PrivateNoteListCard } from '@/components/PrivateNoteListCard';
import { useAppSelector } from '@/store/hooks';
import { selectPostById } from '@/store/slices/postsSlice';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { useTheme } from '@/hooks/useTheme';
import { usePrivateNotes } from '@/hooks/usePrivateNotes';
import { usePrivateNoteThreadsForPost } from '@/hooks/usePrivateNoteThreadsForPost';
import { usePrivateNoteConversationsNotice } from '@/hooks/usePrivateNoteConversationsNotice';
import { usePrivateNoteUnreadForPost } from '@/hooks/usePrivateNoteUnreadForPost';
import { ScreenHeader } from '@/components/ScreenHeader';
import { isFromNotifications } from '@/lib/navigation/entryNavigation.utils';
import { markUserInboxReadForPost } from '@/services/firebase/firestore';
import { dismissNotificationsByData } from '@/services/notifications';

export default function PrivateNotesScreen() {
	const { postId, from } = useLocalSearchParams<{ postId: string; from?: string }>();
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
		if (isFromNotifications(from)) {
			router.dismissTo('/(protected)/notifications');
			return;
		}
		router.dismissTo({ pathname: '/(protected)/post/[id]', params: { id: postId } });
	}, [from, postId, router]);

	useEffect(() => {
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
	const usersMap = useAppSelector(selectAllUsersMapById);

	const isHost = currentUser?.id === post?.authorId;

	const { notes, loaded, subscriptionFailed } = usePrivateNotes({
		postId: isHost ? postId : null,
		hostId: isHost ? post?.authorId : null,
	});

	const noteIds = React.useMemo(() => notes.map((note) => note.id), [notes]);
	usePrivateNoteThreadsForPost({ postId, noteIds });

	const { noteIdsWithUnreadReplies } = usePrivateNoteUnreadForPost({
		postId,
		notes,
		currentUserId: currentUser?.id ?? '',
		isHost: true,
	});

	const unreadReplyNoteIds = React.useMemo(() => new Set(noteIdsWithUnreadReplies), [noteIdsWithUnreadReplies]);
	const { showNotice, dismissNotice } = usePrivateNoteConversationsNotice();

	const openNoteThread = React.useCallback((noteId: string) => {
		dismissNotice();
		router.push({
			pathname: '/(protected)/private-note-thread/[postId]/[noteId]',
			params: { postId: postId ?? '', noteId },
		});
	}, [dismissNotice, postId, router]);

	useEffect(() => {
		if (!post || !currentUser) return;

		if (!isHost) {
			goToPostDetails();
		}
	}, [currentUser, goToPostDetails, isHost, post]);

	const inboxItems = useAppSelector((state) => state.userInbox.items);

	useEffect(() => {
		if (!postId || !isHost || !currentUser) return;
		void markUserInboxReadForPost(currentUser.id, inboxItems, postId, ['private_note']).catch(() => {});
		void dismissNotificationsByData({ type: 'private_note', postId }).catch(() => {
			return null;
		});
	}, [currentUser, inboxItems, postId, isHost]);

	if (!post || !currentUser || !isHost) {
		return (
			<View style={[styles.centered, { backgroundColor: theme.background }]} />
		);
	}

	return (
		<View style={{ flex: 1, backgroundColor: theme.background }}>
			<ScreenHeader title="Private Notes" onBack={goToPostDetails} />
			<ScrollView
				style={{ flex: 1, backgroundColor: theme.background }}
				contentContainerStyle={[
					styles.content,
					{ paddingBottom: insets.bottom + 24 },
				]}
			>
				{showNotice ? <PrivateNoteConversationsNotice onDismiss={dismissNotice} /> : null}
				{loaded && !subscriptionFailed && notes.length === 0 ? (
					<View
						style={[
							styles.emptyState,
							{ backgroundColor: theme.card, borderColor: theme.border },
						]}
					>
						<Text style={[styles.emptyStateTitle, { color: theme.foreground }]}>No private notes yet</Text>
						<Text style={[styles.emptyStateBody, { color: theme.mutedForeground }]}>As soon as someone sends one, it will pop up here.</Text>
					</View>
				) : null}
				{notes.map((note) => {
					const author = usersMap[note.authorId];
					const authorName = author
						? `${author.firstName} ${author.lastName}`
						: 'Someone';

					return (
					<PrivateNoteListCard
						key={note.id}
						note={note}
						author={author}
						authorLabel={authorName}
						hasUnreadReply={unreadReplyNoteIds.has(note.id)}
						onPress={() => openNoteThread(note.id)}
					/>
					);
				})}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	centered: {
		flex: 1,
	},
	content: {
		paddingHorizontal: 20,
		paddingTop: 16,
		gap: 12,
	},
	emptyState: {
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 16,
		gap: 4,
	},
	emptyStateTitle: {
		fontSize: 15,
		fontWeight: '600',
	},
	emptyStateBody: {
		fontSize: 13,
		lineHeight: 18,
	},
});
