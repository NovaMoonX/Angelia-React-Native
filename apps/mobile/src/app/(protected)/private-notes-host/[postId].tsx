import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation, type EventArg } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { useAppSelector } from '@/store/hooks';
import { selectPostById } from '@/store/slices/postsSlice';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { useTheme } from '@/hooks/useTheme';
import { usePrivateNotes } from '@/hooks/usePrivateNotes';
import { getRelativeTime } from '@/lib/timeUtils';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PRIVATE_NOTES_SEEN_KEY } from '@/models/constants';
import { dismissNotificationsByData } from '@/services/notifications';

export default function PrivateNotesScreen() {
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

	// Only the host (post author) should be viewing this screen
	const isHost = currentUser?.id === post?.authorId;

	const { notes, loaded, subscriptionFailed } = usePrivateNotes({
		postId: isHost ? postId : null,
		hostId: isHost ? post?.authorId : null,
	});

	// Guard: redirect back if not the host, or notes are genuinely empty after loading.
	// For host views, do not auto-exit on empty notes: first-note timing can briefly
	// resolve as loaded+empty and cause an unintended bounce to feed.
	useEffect(() => {
		if (!post || !currentUser) return;

		if (!isHost) {
			goToPostDetails();
		}
	}, [currentUser, goToPostDetails, isHost, post]);

	// Mark notes as seen when the host opens the screen, so the unread indicator clears.
	// Runs once per screen mount (postId/isHost are stable during screen lifetime).
	useEffect(() => {
		if (!postId || !isHost) return;
		void AsyncStorage.setItem(PRIVATE_NOTES_SEEN_KEY(postId), String(Date.now()));
		void dismissNotificationsByData({ type: 'private_note', postId }).catch(() => {
			return null;
		});
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [postId, isHost]);

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
						<View
							key={note.id}
							style={[
								styles.noteCard,
								{
									backgroundColor: theme.card,
									borderColor: theme.border,
								},
							]}
						>
							<Avatar
								user={author}
								size='sm'
								showStatus={false}
							/>
							<View style={styles.noteContent}>
								<View style={styles.noteHeader}>
									<Text style={[styles.authorName, { color: theme.foreground }]}>
										{authorName}
									</Text>
									<Text style={[styles.timestamp, { color: theme.mutedForeground }]}>
										{getRelativeTime(note.timestamp)}
									</Text>
								</View>
								<Text style={[styles.noteText, { color: theme.foreground }]}>
									{note.text}
								</Text>
							</View>
						</View>
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
	noteCard: {
		flexDirection: 'row',
		borderWidth: 1,
		borderRadius: 12,
		padding: 14,
		gap: 12,
	},
	noteContent: {
		flex: 1,
		gap: 4,
	},
	noteHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 8,
	},
	authorName: {
		fontSize: 14,
		fontWeight: '600',
	},
	timestamp: {
		fontSize: 12,
	},
	noteText: {
		fontSize: 14,
		lineHeight: 20,
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
