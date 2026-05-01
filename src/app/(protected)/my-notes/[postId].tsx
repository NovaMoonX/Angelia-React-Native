import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { useAppSelector } from '@/store/hooks';
import { selectPostById } from '@/store/slices/postsSlice';
import { useTheme } from '@/hooks/useTheme';
import { useSentPrivateNotes } from '@/hooks/useSentPrivateNotes';
import { getRelativeTime } from '@/lib/timeUtils';
import { ScreenHeader } from '@/components/ScreenHeader';

export default function MyPrivateNotesScreen() {
	const { postId } = useLocalSearchParams<{ postId: string }>();
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const router = useRouter();

	const post = useAppSelector((state) => selectPostById(state, postId ?? ''));
	const currentUser = useAppSelector((state) => state.users.currentUser);

	// Only the visitor (non-host) should view this screen
	const isHost = currentUser?.id === post?.authorId;

	const { sentNotes } = useSentPrivateNotes({ postId: isHost ? null : postId });

	// Guard: hosts are redirected back; non-existent posts also redirect
	useEffect(() => {
		if (!post || !currentUser) return;
		if (isHost) router.back();
	}, [isHost, post, currentUser, router]);

	if (!post || !currentUser || isHost) {
		return null;
	}

	return (
		<View style={{ flex: 1, backgroundColor: theme.background }}>
			<ScreenHeader title='Your Notes' />
			<ScrollView
				style={{ flex: 1, backgroundColor: theme.background }}
				contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
			>
				{sentNotes.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
							No notes sent yet
						</Text>
					</View>
				) : (
					sentNotes.map((note) => (
						<View
							key={note.id}
							style={[styles.noteCard, { backgroundColor: theme.card, borderColor: theme.border }]}
						>
							<Avatar user={currentUser} size='sm' />
							<View style={styles.noteContent}>
								<View style={styles.noteHeader}>
									<Text style={[styles.authorName, { color: theme.foreground }]}>You</Text>
									<Text style={[styles.timestamp, { color: theme.mutedForeground }]}>
										{getRelativeTime(note.timestamp)}
									</Text>
								</View>
								<Text style={[styles.noteText, { color: theme.foreground }]}>{note.text}</Text>
							</View>
						</View>
					))
				)}
			</ScrollView>
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
