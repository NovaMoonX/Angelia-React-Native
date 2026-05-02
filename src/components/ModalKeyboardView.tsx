/**
 * ModalKeyboardView + useModalSheetPadding
 *
 * Centralises the cross-platform keyboard-avoidance pattern for bottom-sheet
 * <Modal> components. The problem it solves:
 *
 *   • iOS: KeyboardAvoidingView behavior='padding' works perfectly inside a
 *     Modal and animates the sheet up with the keyboard.
 *
 *   • Android: KAV inside a Modal does NOT work reliably. The Modal is rendered
 *     outside the normal layout tree, so Android's window soft-input mode
 *     (adjustPan / adjustResize) doesn't apply. KAV's paddingBottom may leave a
 *     permanent gap below the sheet after the keyboard is dismissed. The fix is
 *     to bypass KAV on Android entirely and instead track keyboard height via
 *     Keyboard event listeners, then apply it as paddingBottom on the sheet.
 *
 * Usage:
 *
 *   // 1. Wrap the Modal's inner content with ModalKeyboardView (handles iOS KAV)
 *   // 2. Call useModalSheetPadding() to get the correct paddingBottom for the sheet
 *
 *   const sheetBottomPadding = useModalSheetPadding(insets.bottom + 16);
 *
 *   return (
 *     <Modal visible={visible} transparent animationType='slide'>
 *       <ModalKeyboardView>
 *         <Pressable style={styles.backdrop} onPress={onClose}>
 *           <View style={[styles.sheet, { paddingBottom: sheetBottomPadding }]}>
 *             ...
 *           </View>
 *         </Pressable>
 *       </ModalKeyboardView>
 *     </Modal>
 *   );
 */

import React, { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, View } from 'react-native';

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the correct `paddingBottom` value to apply to a bottom-sheet inside
 * a Modal.
 *
 * @param basePadding The baseline padding to use when the keyboard is not shown
 *   (typically `insets.bottom + 16`).
 *
 * On iOS the value is always `basePadding` — KeyboardAvoidingView handles the
 * rest. On Android it grows to accommodate the keyboard height when shown.
 */
export function useModalSheetPadding(basePadding: number): number {
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

	if (Platform.OS === 'android' && androidKeyboardHeight > 0) {
		return androidKeyboardHeight + 16;
	}
	return basePadding;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ModalKeyboardViewProps {
	children: React.ReactNode;
	style?: React.ComponentProps<typeof View>['style'];
}

/**
 * Drop-in wrapper for the content inside a `<Modal>`.
 *
 * - iOS: renders a `KeyboardAvoidingView` with `behavior='padding'` so the
 *   sheet slides up with the keyboard.
 * - Android: renders a plain `View`. Keyboard offset is handled separately by
 *   `useModalSheetPadding` applied as `paddingBottom` on the sheet itself.
 */
export function ModalKeyboardView({ children, style }: ModalKeyboardViewProps) {
	if (Platform.OS === 'ios') {
		return (
			<KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior='padding'>
				{children}
			</KeyboardAvoidingView>
		);
	}
	return (
		<View style={[{ flex: 1 }, style]}>
			{children}
		</View>
	);
}
