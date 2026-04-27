import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { useAppSelector } from '@/store/hooks';
import { selectPostById } from '@/store/slices/postsSlice';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { useTheme } from '@/hooks/useTheme';
import { usePrivateNotes } from '@/hooks/usePrivateNotes';
import { getRelativeTime } from '@/lib/timeUtils';
import { isStatusActive } from '@/components/NowStatusBadge';
import { ScreenHeader } from '@/components/ScreenHeader';

const PRIVATE_NOTES_SEEN_KEY = (postId: string) => `@angelia/private_notes_seen_${postId}`;

export default function PrivateNotesScreen() {
	const { postId } = useLocalSearchParams<{ postId: string }>();
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const router = useRouter();

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
	// `subscriptionFailed` prevents a false redirect when Firestore denies the read —
	// in that case we stay on-screen so the error is visible in logs.
	useEffect(() => {
		if (!post || !currentUser) return;
		if (!isHost || (loaded && !subscriptionFailed && notes.length === 0)) {
			router.back();
		}
	}, [isHost, loaded, subscriptionFailed, notes.length, post, currentUser, router]);

	// Mark notes as seen when the host opens the screen, so the unread indicator clears.
	// Runs once per screen mount (postId/isHost are stable during screen lifetime).
	useEffect(() => {
		if (!postId || !isHost) return;
		void AsyncStorage.setItem(PRIVATE_NOTES_SEEN_KEY(postId), String(Date.now()));
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [postId, isHost]);

	if (!post || !currentUser || !isHost || (loaded && !subscriptionFailed && notes.length === 0)) {
		return (
			<View style={[styles.centered, { backgroundColor: theme.background }]} />
		);
	}

	return (
		<View style={{ flex: 1, backgroundColor: theme.background }}>
			<ScreenHeader title="Private Notes" />
			<ScrollView
				style={{ flex: 1, backgroundColor: theme.background }}
				contentContainerStyle={[
					styles.content,
					{ paddingBottom: insets.bottom + 24 },
				]}
			>
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
								statusEmoji={
									isStatusActive(author?.status) ? author?.status?.emoji : undefined
								}
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
});
