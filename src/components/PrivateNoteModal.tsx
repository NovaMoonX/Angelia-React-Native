import React, { useState, useCallback } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch } from '@/store/hooks';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { sendPrivateNote } from '@/store/actions/privateNoteActions';

interface PrivateNoteModalProps {
	visible: boolean;
	onClose: () => void;
	postId: string;
	postAuthorId: string;
	authorFirstName: string | undefined;
}

/**
 * Bottom-sheet modal that lets a visitor compose and send a private note to
 * the post author.
 *
 * NOTE (Android keyboard dismiss):
 * Using `behavior='padding'` on both iOS and Android prevents the bottom-sheet
 * from jumping between bottom-aligned and padded positions when the keyboard
 * is closed inside the modal. The `height` behavior on Android causes the KAV
 * container height to animate on keyboard hide, which forces the flex-end sheet
 * to re-anchor and creates a visible jump. `padding` adjusts only the internal
 * padding, leaving the container height stable and eliminating the jump.
 */
export function PrivateNoteModal({
	visible,
	onClose,
	postId,
	postAuthorId,
	authorFirstName,
}: PrivateNoteModalProps) {
	const dispatch = useAppDispatch();
	const { theme } = useTheme();
	const { addToast } = useToast();
	const insets = useSafeAreaInsets();

	const [text, setText] = useState('');
	const [sending, setSending] = useState(false);

	const handleClose = useCallback(() => {
		onClose();
		setText('');
	}, [onClose]);

	const handleSend = useCallback(async () => {
		if (!text.trim() || !postAuthorId) return;
		setSending(true);
		try {
			await dispatch(sendPrivateNote({ postId, hostId: postAuthorId, text })).unwrap();
			setText('');
			onClose();
			addToast({ type: 'success', title: 'Note sent!' });
		} catch {
			addToast({ type: 'error', title: 'Failed to send note' });
		} finally {
			setSending(false);
		}
	}, [text, postAuthorId, postId, dispatch, onClose, addToast]);

	return (
		<Modal visible={visible} transparent animationType='slide' onRequestClose={handleClose}>
			<KeyboardAvoidingView style={{ flex: 1 }} behavior='padding'>
				<Pressable style={styles.backdrop} onPress={handleClose}>
					<View
						style={[
							styles.sheet,
							{ backgroundColor: theme.card, paddingBottom: insets.bottom + 16 },
						]}
						onStartShouldSetResponder={() => { return true; }}
					>
						{/* Header */}
						<View style={[styles.header, { borderBottomColor: theme.border }]}>
							<Text style={[styles.title, { color: theme.foreground }]}>
								Private note to {authorFirstName ?? 'host'}
							</Text>
							<Pressable onPress={handleClose} hitSlop={8}>
								<Text style={[styles.closeBtn, { color: theme.mutedForeground }]}>✕</Text>
							</Pressable>
						</View>

						{/* Body */}
						<View style={styles.body}>
							<Text style={[styles.nudge, { color: theme.mutedForeground }]}>
								Want to tell {authorFirstName ?? 'them'} something just between you two?
							</Text>
							<TextInput
								style={[
									styles.input,
									{
										backgroundColor: theme.background,
										borderColor: theme.border,
										color: theme.foreground,
									},
								]}
								placeholder='Write your note…'
								placeholderTextColor={theme.mutedForeground}
								value={text}
								onChangeText={setText}
								multiline
								maxLength={500}
								editable={!sending}
								autoFocus
							/>
							<Pressable
								style={[
									styles.sendButton,
									{
										backgroundColor:
											text.trim() && !sending ? theme.primary : theme.muted,
									},
								]}
								onPress={handleSend}
								disabled={!text.trim() || sending}
							>
								<Text style={[styles.sendText, { color: theme.primaryForeground }]}>
									{sending ? 'Sending…' : 'Send note'}
								</Text>
							</Pressable>
						</View>
					</View>
				</Pressable>
			</KeyboardAvoidingView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.5)',
		justifyContent: 'flex-end',
	},
	sheet: {
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.15,
		shadowRadius: 12,
		elevation: 8,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingVertical: 16,
		borderBottomWidth: 1,
	},
	title: {
		fontSize: 16,
		fontWeight: '600',
	},
	closeBtn: {
		fontSize: 18,
		fontWeight: '600',
	},
	body: {
		padding: 20,
		gap: 14,
	},
	nudge: {
		fontSize: 13,
		lineHeight: 18,
	},
	input: {
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		fontSize: 15,
		lineHeight: 22,
		minHeight: 100,
		maxHeight: 200,
		textAlignVertical: 'top',
	},
	sendButton: {
		paddingVertical: 13,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	sendText: {
		fontSize: 15,
		fontWeight: '600',
	},
});
