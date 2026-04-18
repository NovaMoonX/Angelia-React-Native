import { Platform } from 'react-native';

/** Vertical offset used with KeyboardAvoidingView to account for header height. */
export const KEYBOARD_VERTICAL_OFFSET = Platform.OS === 'ios' ? 90 : 0;

/** KeyboardAvoidingView behavior per platform. */
export const KEYBOARD_BEHAVIOR: 'padding' | 'height' | 'position' | undefined =
  Platform.OS === 'ios' ? 'padding' : undefined;
