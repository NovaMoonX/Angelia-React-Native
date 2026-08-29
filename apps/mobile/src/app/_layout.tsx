import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as ReduxProvider } from 'react-redux';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync } from 'expo-audio';
import { store } from '@/store';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { ActionModalProvider } from '@/providers/ActionModalProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useTheme } from '@/hooks/useTheme';
import {
	NOTIFICATION_ID,
	WIND_DOWN_NOTIFICATION_ID,
	getFollowUpForPrompt,
	getFollowUpForWindDown,
	dismissNotificationsByData,
} from '@/services/notifications';
import {
	isNotificationResponseHandled,
	markNotificationResponseHandled,
} from '@/lib/notificationResponseDedup';
import { withNotificationsEntry } from '@/lib/navigation/entryNavigation.utils';
import { pushRouteWhenNavigatorReady } from '@/lib/pushRouteWhenReady';

/** Matches the key used in DataListenerWrapper to track whether the in-app daily notice has already been shown today. */
const DAILY_PROMPT_SHOWN_DATE_KEY = '@angelia/daily_prompt_shown_date';

function toStringRecord(value: unknown): Record<string, string> | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		if (typeof v === 'string') {
			out[k] = v;
		} else if (typeof v === 'number' || typeof v === 'boolean') {
			out[k] = String(v);
		}
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

function extractNotificationData(notification: Notifications.Notification): Record<string, string> | undefined {
	const contentData = toStringRecord(notification.request.content.data);
	if (contentData && Object.keys(contentData).length > 0) {
		return contentData;
	}

	// iOS push notifications can surface custom keys in trigger.payload, not content.data.
	const triggerAny = notification.request.trigger as unknown as { payload?: unknown } | null;
	const payload = triggerAny?.payload;
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return undefined;
	}

	const payloadRecord = payload as Record<string, unknown>;

	// Common shapes: payload.data.{...} OR payload.{type, postId, ...}
	const nestedData = toStringRecord(payloadRecord.data);
	if (nestedData && Object.keys(nestedData).length > 0) {
		return nestedData;
	}

	return toStringRecord(payloadRecord);
}

function pushRoute(pathname: string, params?: Record<string, string>) {
	if (params) {
		router.push({ pathname, params } as never);
	} else {
		router.push(pathname as never);
	}
}

// Configure how notifications are presented when the app is in the foreground.
// Daily prompt local notifications are handled in-app by DataListenerWrapper
// (Effect 10) and should not also show as a system banner — suppress them here
// based on whether the user has already posted today or the in-app notice was
// already shown today.
Notifications.setNotificationHandler({
	handleNotification: async (notification) => {
		const identifier = notification.request.identifier;

		if (identifier === NOTIFICATION_ID || identifier === WIND_DOWN_NOTIFICATION_ID) {
			// Check if the current user has already posted today (Redux store).
			const state = store.getState();
			const currentUser = state.users.currentUser;
			const posts = state.posts.items;
			const today = new Date().toDateString();

			const hasPostedToday =
				currentUser != null &&
				posts.some(
					(p) => p.authorId === currentUser.id && new Date(p.timestamp).toDateString() === today,
				);

			if (hasPostedToday) {
				return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
			}

			// Suppress the system banner if we've already shown the in-app notice today.
			// The in-app notice (Effect 10 in DataListenerWrapper) will handle display
			// and mark the key; if it's already marked we stay silent here too.
			try {
				const shownDate = await AsyncStorage.getItem(DAILY_PROMPT_SHOWN_DATE_KEY);
				if (shownDate === today) {
					return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
				}
			} catch {
				// AsyncStorage failure — fall through to suppress banner anyway;
				// DataListenerWrapper will handle the in-app notice.
			}

			// Suppress the system banner — DataListenerWrapper Effect 10 will show
			// an in-app toast instead, which is richer and context-aware.
			return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
		}

		return {
			shouldShowBanner: true,
			shouldShowList: true,
			shouldPlaySound: true,
			shouldSetBadge: false,
		};
	},
});

// Register a global response handler so that notification taps from
// background / quit states navigate to the appropriate screen.
Notifications.addNotificationResponseReceivedListener((response) => {
	void (async () => {
		const notification = response.notification;
		const data = extractNotificationData(notification);
		const type = data?.type;
		const identifier = notification.request.identifier;

		if (await isNotificationResponseHandled(response)) {
			return;
		}

		const navigate = () => {
			if (identifier === NOTIFICATION_ID || identifier === WIND_DOWN_NOTIFICATION_ID) {
				const promptIndex = parseInt((data?.promptIndex as string) ?? '0', 10);
				const followUp = identifier === WIND_DOWN_NOTIFICATION_ID
					? getFollowUpForWindDown(promptIndex)
					: getFollowUpForPrompt(promptIndex);
				pushRoute('/(protected)/post/new', { existingText: followUp });
				return;
			}

			if (type === 'join_channel_request') {
				const joinRequestId = data?.joinRequestId;
				if (joinRequestId) {
					pushRoute('/(protected)/join-request/[id]', withNotificationsEntry({ id: joinRequestId }));
				} else {
					pushRoute('/(protected)/notifications');
				}
				return;
			}

			if (type === 'join_channel_accepted') {
				const channelName = data?.channelName ?? '';
				pushRoute('/(protected)/channel-accepted', withNotificationsEntry({ channelName }));
				return;
			}

			if (type === 'custom_circle_invite') {
				const requestId = data?.requestId;
				if (requestId) {
					pushRoute('/(protected)/circle-invite/[id]', withNotificationsEntry({ id: requestId }));
				} else {
					pushRoute('/(protected)/notifications');
				}
				return;
			}

			if (type === 'connection_request') {
				const requestId = data?.connectionRequestId;
				if (requestId) {
					pushRoute('/(protected)/connection-request/[id]', withNotificationsEntry({ id: requestId }));
				} else {
					pushRoute('/(protected)/notifications');
				}
				return;
			}

			if (type === 'connection_accepted') {
				pushRoute('/(protected)/my-people', withNotificationsEntry());
				return;
			}

			if (type === 'new_post') {
				const postId = data?.postId;
				if (postId) {
					void dismissNotificationsByData({ type: 'new_post', postId });
					pushRoute('/(protected)/post/[id]', withNotificationsEntry({ id: postId }));
				}
				return;
			}

			if (type === 'post_reaction') {
				const postId = data?.postId;
				if (postId) {
					void dismissNotificationsByData({ type: 'post_reaction', postId });
					pushRoute('/(protected)/post/[id]', withNotificationsEntry({ id: postId }));
				}
				return;
			}

			if (type === 'conversation_message' || type === 'comment_reply') {
				const postId = data?.postId;
				if (postId) {
					void dismissNotificationsByData({ type, postId });
					pushRoute('/(protected)/conversation', withNotificationsEntry({ postId }));
				}
				return;
			}

			if (type === 'private_note') {
				const postId = data?.postId;
				if (postId) {
					void dismissNotificationsByData({ type: 'private_note', postId });
					pushRoute('/(protected)/private-notes-host/[postId]', withNotificationsEntry({ postId }));
				}
				return;
			}

			if (type === 'private_note_reply') {
				const postId = data?.postId;
				const noteId = data?.noteId;
				if (postId && noteId) {
					void dismissNotificationsByData({ type: 'private_note_reply', postId, noteId });
					pushRoute(
						'/(protected)/private-note-thread/[postId]/[noteId]',
						withNotificationsEntry({ postId, noteId }),
					);
				}
			}
		};

		const didNavigate = await pushRouteWhenNavigatorReady(
			navigate,
			() => isNotificationResponseHandled(response),
		);
		if (didNavigate) {
			await markNotificationResponseHandled(response);
		}
	})();
});

function NavigationLayout() {
	const { resolvedTheme, theme } = useTheme();

	useEffect(() => {
		void setAudioModeAsync({
			playsInSilentMode: true,
			shouldPlayInBackground: false,
			allowsRecording: false,
		});
	}, []);

	return (
		<>
			<StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
			<Stack
				screenOptions={{
					headerStyle: { backgroundColor: theme.background },
					headerTintColor: theme.foreground,
					headerTitleStyle: { fontWeight: '600' },
					contentStyle: { backgroundColor: theme.background },
					animation: 'slide_from_right',
				}}
			>
				<Stack.Screen name='index' options={{ headerShown: false }} />
				<Stack.Screen name='about' options={{ headerShown: false }} />
				<Stack.Screen name='auth' options={{ headerShown: false }} />
				<Stack.Screen name='complete-profile' options={{ headerShown: false }} />
				<Stack.Screen name='verify-email' options={{ headerShown: false }} />
				<Stack.Screen name='join-channel' options={{ headerShown: false }} />
			<Stack.Screen name='connect-request' options={{ headerShown: false }} />
				<Stack.Screen name='scan-qr' options={{ headerShown: false, animation: 'slide_from_bottom' }} />
				<Stack.Screen name='(protected)' options={{ headerShown: false }} />
				<Stack.Screen name='+not-found' options={{ title: 'Not Found' }} />
			</Stack>
		</>
	);
}

export default function RootLayout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<ReduxProvider store={store}>
				<SafeAreaProvider>
					<ThemeProvider>
						<ErrorBoundary fallback={null}>
							<ToastProvider>
								<ActionModalProvider>
									<AuthProvider>
										<NavigationLayout />
									</AuthProvider>
								</ActionModalProvider>
							</ToastProvider>
						</ErrorBoundary>
					</ThemeProvider>
				</SafeAreaProvider>
			</ReduxProvider>
		</GestureHandlerRootView>
	);
}
