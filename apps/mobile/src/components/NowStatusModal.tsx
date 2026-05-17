import React, { useState, useCallback, useEffect } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { EmojiPicker } from '@/components/EmojiPicker';
import { STATUS_INDEFINITE_EXPIRES_AT } from '@/models/constants';
import type { UserStatus } from '@/models/types';

interface NowStatusModalProps {
	visible: boolean;
	onClose: () => void;
	onSave: (status: UserStatus) => void;
	onClear: () => void;
	currentStatus: UserStatus | null | undefined;
}

const DURATION_OPTIONS = [
	{ label: '30 minutes', ms: 30 * 60 * 1000 },
	{ label: '1 hour', ms: 60 * 60 * 1000 },
	{ label: '4 hours', ms: 4 * 60 * 60 * 1000 },
	{ label: '8 hours', ms: 8 * 60 * 60 * 1000 },
	{ label: 'Until I clear it', ms: Number.POSITIVE_INFINITY },
	{ label: 'Custom', ms: -1 }, // shows custom hours/minutes inputs
];

type ExpiryMode = 'duration' | 'exact-time';

const EXPIRY_MODE_OPTIONS: Array<{ mode: ExpiryMode; label: string }> = [
	{ mode: 'duration', label: 'Duration' },
	{ mode: 'exact-time', label: 'Exact time' },
];

const SUGGESTIONS = [
	{ emoji: '💼', text: 'At work' },
	{ emoji: '🎉', text: 'Big win today' },
	{ emoji: '😴', text: 'Feeling tired' },
	{ emoji: '🍕', text: 'Cooking dinner' },
	{ emoji: '🏃', text: 'Out for a run' },
	{ emoji: '📚', text: 'Studying' },
	{ emoji: '🎮', text: 'Gaming' },
	{ emoji: '✈️', text: 'Traveling' },
];

function formatExactTimeSelection(date: Date): string {
	return date.toLocaleString([], {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

function getDefaultExactExpiryAt(): Date {
	const THIRTY_MINUTES_MS = 30 * 60 * 1000;
	const oneHourFromNow = Date.now() + (60 * 60 * 1000);
	const rounded = Math.round(oneHourFromNow / THIRTY_MINUTES_MS) * THIRTY_MINUTES_MS;
	return new Date(rounded);
}

function getTodayStart(date: Date): Date {
	const todayStart = new Date(date);
	todayStart.setHours(0, 0, 0, 0);
	return todayStart;
}

function snapExactExpiryAtToPresent(candidate: Date): Date {
	const now = new Date();
	if (candidate.getTime() < now.getTime()) {
		return now;
	}
	return candidate;
}

export function NowStatusModal({ visible, onClose, onSave, onClear, currentStatus }: NowStatusModalProps) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();

	const [emoji, setEmoji] = useState(currentStatus?.emoji || '😊');
	const [text, setText] = useState(currentStatus?.text || '');
	const [expiryMode, setExpiryMode] = useState<ExpiryMode>('duration');
	const [selectedDuration, setSelectedDuration] = useState(2); // default: 4 hours
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const [customHours, setCustomHours] = useState('');
	const [customMinutes, setCustomMinutes] = useState('');
	const [exactExpiryAt, setExactExpiryAt] = useState<Date>(() => {
		return getDefaultExactExpiryAt();
	});
	const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
	const [showAndroidTimePicker, setShowAndroidTimePicker] = useState(false);
	const [showIosDatePicker, setShowIosDatePicker] = useState(false);
	const [showIosTimePicker, setShowIosTimePicker] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	// Snapshot whether a status was active at open time so the UI stays
	// stable during the close animation (Redux clears currentStatus immediately).
	const [hadExistingStatus, setHadExistingStatus] = useState(false);

	const hasExistingStatus = hadExistingStatus;
	const now = new Date();
	const todayStart = getTodayStart(now);
	const isExactExpiryToday = exactExpiryAt.toDateString() === now.toDateString();

	// Sync form with currentStatus every time the modal opens so it always
	// reflects the latest active status instead of the stale initial state.
	useEffect(() => {
		if (!visible) return;
		const active = currentStatus && Date.now() < (currentStatus.expiresAt ?? 0) ? currentStatus : null;
		setEmoji(active?.emoji ?? '😊');
		setText(active?.text ?? '');
		setExpiryMode('duration');
		setSelectedDuration(2);
		setShowEmojiPicker(false);
		setCustomHours('');
		setCustomMinutes('');
		setExactExpiryAt(getDefaultExactExpiryAt());
		setShowAndroidDatePicker(false);
		setShowAndroidTimePicker(false);
		setShowIosDatePicker(false);
		setShowIosTimePicker(false);
		setSaveError(null);
		setHadExistingStatus(active != null);
	}, [visible, currentStatus]);

	const handleClose = useCallback(() => {
		onClose();
	}, [onClose]);

	const handleSave = useCallback(() => {
		if (!text.trim()) return;

		const now = Date.now();
		let expiresAt: number;

		if (expiryMode === 'exact-time') {
			expiresAt = exactExpiryAt.getTime();
			if (expiresAt <= now) {
				setSaveError('Pick a future time so your status does not expire immediately.');
				return;
			}
		} else {
			const option = DURATION_OPTIONS[selectedDuration];
			if (option.label === 'Until I clear it') {
				expiresAt = STATUS_INDEFINITE_EXPIRES_AT;
			} else if (option.label === 'Custom') {
				const h = Number(customHours) || 0;
				const m = Number(customMinutes) || 0;
				const totalMs = (h * 60 + m) * 60 * 1000;
				expiresAt = now + (totalMs > 0 ? totalMs : 60 * 60 * 1000);
			} else {
				expiresAt = now + option.ms;
			}
		}

		setSaveError(null);

		onSave({
			emoji,
			text: text.trim(),
			updatedAt: now,
			expiresAt,
		});
	}, [text, emoji, expiryMode, selectedDuration, customHours, customMinutes, exactExpiryAt, onSave]);

	const handleClear = useCallback(() => {
		onClear();
	}, [onClear]);

	const handleSuggestion = useCallback((s: { emoji: string; text: string }) => {
		setEmoji(s.emoji);
		setText(s.text);
	}, []);

	const handleEmojiSelect = useCallback((e: string) => {
		setEmoji(e);
		setShowEmojiPicker(false);
	}, []);

	const openDatePicker = useCallback(() => {
		setExactExpiryAt((prev) => {
			return snapExactExpiryAtToPresent(prev);
		});
		if (Platform.OS === 'ios') {
			setShowIosDatePicker(true);
			return;
		}
		setShowAndroidDatePicker(true);
	}, []);

	const openTimePicker = useCallback(() => {
		setExactExpiryAt((prev) => {
			return snapExactExpiryAtToPresent(prev);
		});
		if (Platform.OS === 'ios') {
			setShowIosTimePicker(true);
			return;
		}
		setShowAndroidTimePicker(true);
	}, []);

	const handleAndroidDateChange = useCallback((_event: DateTimePickerEvent, selected?: Date) => {
		setShowAndroidDatePicker(false);
		if (!selected) return;
		setExactExpiryAt((prev) => {
			const nowDate = new Date();
			const selectedStart = getTodayStart(selected);
			const nowStart = getTodayStart(nowDate);
			const next = new Date(prev);
			if (selectedStart.getTime() < nowStart.getTime()) {
				next.setFullYear(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
			} else {
				next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
			}
			return snapExactExpiryAtToPresent(next);
		});
	}, []);

	const handleAndroidTimeChange = useCallback((_event: DateTimePickerEvent, selected?: Date) => {
		setShowAndroidTimePicker(false);
		if (!selected) return;
		setExactExpiryAt((prev) => {
			const nowDate = new Date();
			const next = new Date(prev);
			next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
			if (next.toDateString() === nowDate.toDateString() && next.getTime() < nowDate.getTime()) {
				next.setHours(nowDate.getHours(), nowDate.getMinutes(), nowDate.getSeconds(), nowDate.getMilliseconds());
			}
			return snapExactExpiryAtToPresent(next);
		});
	}, []);

	return (
		<Modal visible={visible} transparent animationType='slide' onRequestClose={handleClose}>
			<Pressable style={styles.backdrop} onPress={handleClose}>
				<View
					style={[
						styles.sheet,
						{
							backgroundColor: theme.card,
							paddingBottom: insets.bottom + 16,
						},
					]}
					onStartShouldSetResponder={() => true}
				>
					{/* Header */}
					<View style={[styles.header, { borderBottomColor: theme.border }]}>
						<Text style={[styles.title, { color: theme.foreground }]}>Set your status</Text>
						<Pressable onPress={handleClose} hitSlop={8}>
							<Text style={[styles.closeBtn, { color: theme.mutedForeground }]}>✕</Text>
						</Pressable>
					</View>

					<ScrollView
						style={styles.body}
						contentContainerStyle={styles.bodyContent}
						keyboardShouldPersistTaps='handled'
						showsVerticalScrollIndicator={false}
					>
						{/* Emoji + text input row */}
						<View style={styles.inputRow}>
							<Pressable
								onPress={() => setShowEmojiPicker(true)}
								style={[styles.emojiButton, { backgroundColor: theme.background, borderColor: theme.border }]}
							>
								<Text style={styles.emojiPreview}>{emoji}</Text>
							</Pressable>
							<TextInput
								value={text}
								onChangeText={setText}
								placeholder="What's happening?"
								placeholderTextColor={theme.mutedForeground}
								maxLength={80}
								style={[
									styles.textInput,
									{
										color: theme.foreground,
										backgroundColor: theme.background,
										borderColor: theme.border,
									},
								]}
								autoCorrect={false}
								returnKeyType='done'
							/>
						</View>

						{/* Quick suggestions */}
						<Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Suggestions</Text>
						<View style={styles.suggestionsWrap}>
							{SUGGESTIONS.map((s) => (
								<Pressable
									key={s.text}
									onPress={() => handleSuggestion(s)}
									style={[styles.suggestionChip, { backgroundColor: theme.background, borderColor: theme.border }]}
								>
									<Text style={styles.suggestionEmoji}>{s.emoji}</Text>
									<Text style={[styles.suggestionText, { color: theme.foreground }]}>{s.text}</Text>
								</Pressable>
							))}
						</View>

						{/* Duration picker */}
						<Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Expires</Text>
						<View style={styles.modeRadioRow}>
							{EXPIRY_MODE_OPTIONS.map((option) => {
								const selected = expiryMode === option.mode;
								return (
									<Pressable
										key={option.mode}
										onPress={() => {
											setExpiryMode(option.mode);
											setSaveError(null);
										}}
										style={[
											styles.modeRadioOption,
											{
												backgroundColor: selected ? theme.primary + '12' : theme.background,
												borderColor: selected ? theme.primary : theme.border,
											},
										]}
									>
										<View style={[styles.radioOuter, { borderColor: selected ? theme.primary : theme.mutedForeground }]}>
											{selected ? <View style={[styles.radioInner, { backgroundColor: theme.primary }]} /> : null}
										</View>
										<Text style={[styles.modeRadioLabel, { color: theme.foreground }]}>{option.label}</Text>
									</Pressable>
								);
							})}
						</View>

						{expiryMode === 'duration' && (
							<View style={styles.durationsWrap}>
							{DURATION_OPTIONS.map((opt, idx) => {
								const selected = selectedDuration === idx;
								return (
									<Pressable
										key={opt.label}
										onPress={() => setSelectedDuration(idx)}
										style={[
											styles.durationChip,
											{
												backgroundColor: selected ? theme.primary : theme.background,
												borderColor: selected ? theme.primary : theme.border,
											},
										]}
									>
										<Text
											style={[
												styles.durationText,
												{
													color: selected ? theme.primaryForeground : theme.foreground,
												},
											]}
										>
											{opt.label}
										</Text>
									</Pressable>
								);
							})}
							</View>
						)}

						{expiryMode === 'exact-time' && (
							<View style={styles.exactTimeWrap}>
								<Pressable
									onPress={openDatePicker}
									style={[styles.exactTimeChip, { backgroundColor: theme.background, borderColor: theme.border }]}
								>
									<Feather name='calendar' size={15} color={theme.mutedForeground} />
									<Text style={[styles.exactTimeText, { color: theme.foreground }]}>
										{exactExpiryAt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
									</Text>
								</Pressable>
								<Pressable
									onPress={openTimePicker}
									style={[styles.exactTimeChip, { backgroundColor: theme.background, borderColor: theme.border }]}
								>
									<Feather name='clock' size={15} color={theme.mutedForeground} />
									<Text style={[styles.exactTimeText, { color: theme.foreground }]}>
										{exactExpiryAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
									</Text>
								</Pressable>
								<Text style={[styles.exactTimeHint, { color: theme.mutedForeground }]}>
									Expires {formatExactTimeSelection(exactExpiryAt)}
								</Text>
							</View>
						)}

						{/* Custom duration input */}
						{expiryMode === 'duration' && DURATION_OPTIONS[selectedDuration].label === 'Custom' && (
							<View style={styles.customRow}>
								<View style={styles.customField}>
									<TextInput
										value={customHours}
										onChangeText={setCustomHours}
										placeholder='0'
										placeholderTextColor={theme.mutedForeground}
										keyboardType='number-pad'
										maxLength={3}
										style={[
											styles.customInput,
											{
												color: theme.foreground,
												backgroundColor: theme.background,
												borderColor: theme.border,
											},
										]}
									/>
									<Text style={[styles.customLabel, { color: theme.mutedForeground }]}>hours</Text>
								</View>
								<View style={styles.customField}>
									<TextInput
										value={customMinutes}
										onChangeText={setCustomMinutes}
										placeholder='0'
										placeholderTextColor={theme.mutedForeground}
										keyboardType='number-pad'
										maxLength={2}
										style={[
											styles.customInput,
											{
												color: theme.foreground,
												backgroundColor: theme.background,
												borderColor: theme.border,
											},
										]}
									/>
									<Text style={[styles.customLabel, { color: theme.mutedForeground }]}>min</Text>
								</View>
							</View>
						)}

						{saveError ? <Text style={[styles.saveError, { color: theme.destructive }]}>{saveError}</Text> : null}

						{/* Actions */}
						<View style={styles.actions}>
							{hasExistingStatus && (
								<Pressable onPress={handleClear} style={[styles.clearButton, { borderColor: theme.destructive }]}>
									<Feather name='x-circle' size={16} color={theme.destructive} />
									<Text style={[styles.clearText, { color: theme.destructive }]}>Clear status</Text>
								</Pressable>
							)}
							<Pressable
								onPress={handleSave}
								disabled={!text.trim()}
								style={[
									styles.saveButton,
									{
										backgroundColor: text.trim() ? theme.primary : theme.muted,
									},
								]}
							>
								<Text style={[styles.saveText, { color: theme.primaryForeground }]}>Save status</Text>
							</Pressable>
						</View>
					</ScrollView>
				</View>
			</Pressable>

			{Platform.OS === 'android' && showAndroidDatePicker ? (
				<DateTimePicker
					mode='date'
					display='default'
					value={exactExpiryAt}
					minimumDate={todayStart}
					onChange={handleAndroidDateChange}
				/>
			) : null}

			{Platform.OS === 'android' && showAndroidTimePicker ? (
				<DateTimePicker
					mode='time'
					display='default'
					value={exactExpiryAt}
					onChange={handleAndroidTimeChange}
				/>
			) : null}

			<Modal visible={showIosDatePicker} transparent animationType='slide' onRequestClose={() => setShowIosDatePicker(false)}>
				<View style={styles.iosPickerBackdrop}>
					<View style={[styles.iosPickerSheet, { backgroundColor: theme.card, borderColor: theme.border }]}> 
						<View style={[styles.iosPickerHeader, { borderBottomColor: theme.border }]}> 
							<Pressable onPress={() => setShowIosDatePicker(false)}>
								<Text style={[styles.iosPickerCancel, { color: theme.mutedForeground }]}>Cancel</Text>
							</Pressable>
							<Text style={[styles.iosPickerTitle, { color: theme.foreground }]}>Pick date</Text>
							<Pressable onPress={() => setShowIosDatePicker(false)}>
								<Text style={[styles.iosPickerDone, { color: theme.primary }]}>Done</Text>
							</Pressable>
						</View>
						<DateTimePicker
							mode='date'
							display='spinner'
							value={exactExpiryAt}
							minimumDate={todayStart}
							onChange={(_event: DateTimePickerEvent, date?: Date) => {
								if (!date) return;
								setExactExpiryAt((prev) => {
									const nowDate = new Date();
									const dateStart = getTodayStart(date);
									const nowStart = getTodayStart(nowDate);
									const next = new Date(prev);
									if (dateStart.getTime() < nowStart.getTime()) {
										next.setFullYear(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
									} else {
										next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
									}
									return snapExactExpiryAtToPresent(next);
								});
							}}
							style={styles.iosPickerControl}
						/>
					</View>
				</View>
			</Modal>

			<Modal visible={showIosTimePicker} transparent animationType='slide' onRequestClose={() => setShowIosTimePicker(false)}>
				<View style={styles.iosPickerBackdrop}>
					<View style={[styles.iosPickerSheet, { backgroundColor: theme.card, borderColor: theme.border }]}> 
						<View style={[styles.iosPickerHeader, { borderBottomColor: theme.border }]}> 
							<Pressable onPress={() => setShowIosTimePicker(false)}>
								<Text style={[styles.iosPickerCancel, { color: theme.mutedForeground }]}>Cancel</Text>
							</Pressable>
							<Text style={[styles.iosPickerTitle, { color: theme.foreground }]}>Pick time</Text>
							<Pressable onPress={() => setShowIosTimePicker(false)}>
								<Text style={[styles.iosPickerDone, { color: theme.primary }]}>Done</Text>
							</Pressable>
						</View>
						<DateTimePicker
							mode='time'
							display='spinner'
							value={exactExpiryAt}
							minimumDate={isExactExpiryToday ? now : undefined}
							onChange={(_event: DateTimePickerEvent, date?: Date) => {
								if (!date) return;
								setExactExpiryAt((prev) => {
									const nowDate = new Date();
									const next = new Date(prev);
									next.setHours(date.getHours(), date.getMinutes(), 0, 0);
									if (next.toDateString() === nowDate.toDateString() && next.getTime() < nowDate.getTime()) {
										next.setHours(nowDate.getHours(), nowDate.getMinutes(), nowDate.getSeconds(), nowDate.getMilliseconds());
									}
									return snapExactExpiryAtToPresent(next);
								});
							}}
							style={styles.iosPickerControl}
						/>
					</View>
				</View>
			</Modal>

			{/* Emoji picker overlay — must be inside the parent Modal so iOS
          presents it from the correct UIWindow context */}
			<EmojiPicker visible={showEmojiPicker} onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
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
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		maxHeight: '85%',
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
		padding: 16,
		borderBottomWidth: 1,
	},
	title: {
		fontSize: 18,
		fontWeight: '600',
	},
	closeBtn: {
		fontSize: 20,
		fontWeight: '600',
	},
	body: {
		maxHeight: 500,
	},
	bodyContent: {
		padding: 16,
		gap: 16,
	},
	inputRow: {
		flexDirection: 'row',
		gap: 10,
		alignItems: 'center',
	},
	emojiButton: {
		width: 48,
		height: 48,
		borderRadius: 12,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emojiPreview: {
		fontSize: 24,
	},
	textInput: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		fontSize: 15,
	},
	sectionLabel: {
		fontSize: 13,
		fontWeight: '600',
		marginBottom: -8,
	},
	suggestionsWrap: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	suggestionChip: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 16,
		borderWidth: 1,
		gap: 4,
	},
	suggestionEmoji: {
		fontSize: 14,
	},
	suggestionText: {
		fontSize: 13,
	},
	durationsWrap: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	modeRadioRow: {
		flexDirection: 'row',
		gap: 8,
	},
	modeRadioOption: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		flex: 1,
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	radioOuter: {
		width: 18,
		height: 18,
		borderRadius: 9,
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center',
	},
	radioInner: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	modeRadioLabel: {
		fontSize: 14,
		fontWeight: '600',
	},
	durationChip: {
		paddingHorizontal: 12,
		paddingVertical: 7,
		borderRadius: 16,
		borderWidth: 1,
	},
	exactTimeWrap: {
		gap: 8,
	},
	exactTimeChip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 9,
		borderRadius: 10,
		borderWidth: 1,
	},
	exactTimeText: {
		fontSize: 14,
		fontWeight: '500',
	},
	exactTimeHint: {
		fontSize: 12,
	},
	durationText: {
		fontSize: 13,
		fontWeight: '500',
	},
	customRow: {
		flexDirection: 'row',
		gap: 12,
		marginTop: -8,
	},
	customField: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	customInput: {
		width: 56,
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 10,
		paddingVertical: 8,
		fontSize: 14,
		textAlign: 'center',
	},
	customLabel: {
		fontSize: 13,
	},
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 12,
		marginTop: 4,
	},
	saveError: {
		fontSize: 12,
		fontWeight: '500',
		marginTop: -4,
	},
	clearButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 10,
		borderWidth: 1,
		gap: 6,
	},
	clearText: {
		fontSize: 14,
		fontWeight: '600',
	},
	saveButton: {
		paddingHorizontal: 20,
		paddingVertical: 10,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
	},
	saveText: {
		fontSize: 14,
		fontWeight: '600',
	},
	iosPickerBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.5)',
		justifyContent: 'flex-end',
	},
	iosPickerSheet: {
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		borderWidth: 1,
		borderBottomWidth: 0,
	},
	iosPickerHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
	},
	iosPickerCancel: {
		fontSize: 14,
		fontWeight: '500',
	},
	iosPickerTitle: {
		fontSize: 15,
		fontWeight: '600',
	},
	iosPickerDone: {
		fontSize: 14,
		fontWeight: '600',
	},
	iosPickerControl: {
		height: 220,
	},
});
