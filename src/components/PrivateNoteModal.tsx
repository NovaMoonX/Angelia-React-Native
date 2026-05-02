import React, { useState, useCallback, useEffect } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
 * NOTE (Android keyboard):
 * Matches the FeedbackSupportModal pattern: track keyboard height via
 * keyboardDidShow/keyboardDidHide and expand the sheet's paddingBottom
 * instead of using KAV or Animated.Value. KAV is only used on iOS.
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
	const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

	useEffect(() => {
		if (Platform.OS !== 'android') { return; }
		const show = Keyboard.addListener('keyboardDidShow', (e) => {
			setAndroidKeyboardHeight(e.endCoordinates.height);
		});
		const hide = Keyboard.addListener('keyboardDidHide', () => {
			setAndroidKeyboardHeight(0);
		});
		return () => {
			show.remove();
			hide.remove();
		};
	}, []);

	const sheetBottomPadding =
		Platform.OS === 'android' && androidKeyboardHeight > 0
			? androidKeyboardHeight + 16
			: insets.bottom + 16;

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

	const sheetContent = (
		<Pressable style={styles.backdrop} onPress={handleClose}>
			<View
				style={[
					styles.sheet,
					{ backgroundColor: theme.card, paddingBottom: sheetBottomPadding },
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
	);

	return (
		<Modal visible={visible} transparent animationType='slide' onRequestClose={handleClose}>
			{Platform.OS === 'ios' ? (
				<KeyboardAvoidingView style={{ flex: 1 }} behavior='padding'>
					{sheetContent}
				</KeyboardAvoidingView>
			) : sheetContent}
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
