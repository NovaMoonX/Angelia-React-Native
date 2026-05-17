import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation, type EventArg } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { PrivateNoteModal } from '@/components/PrivateNoteModal';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAppSelector } from '@/store/hooks';
import { selectPostById, selectPostAuthor } from '@/store/slices/postsSlice';
import { useTheme } from '@/hooks/useTheme';
import { useSentPrivateNotes } from '@/hooks/useSentPrivateNotes';
import { getRelativeTime } from '@/lib/timeUtils';

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

	// Only the visitor (non-host) should view this screen
	const isHost = currentUser?.id === post?.authorId;

	const { sentNotes } = useSentPrivateNotes({ postId: isHost ? null : postId });

	const [modalVisible, setModalVisible] = useState(false);

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
				{sentNotes.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
							No notes sent yet
						</Text>
					</View>
				) : (
					sentNotes.map((note) => {
						return (
							<View
								key={note.id}
								style={[styles.noteCard, { backgroundColor: theme.card, borderColor: theme.border }]}
							>
								<Avatar user={currentUser} size='sm' showStatus={false} />
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
						);
					})
				)}
			</ScrollView>

			{/* Send another note button — fixed above system insets */}
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
