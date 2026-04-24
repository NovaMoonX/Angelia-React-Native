import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as ReduxProvider } from 'react-redux';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '@/store';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { ActionModalProvider } from '@/providers/ActionModalProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useTheme } from '@/hooks/useTheme';
import { NOTIFICATION_ID, WIND_DOWN_NOTIFICATION_ID, getFollowUpForPrompt, getFollowUpForWindDown } from '@/services/notifications';

/** Matches the key used in DataListenerWrapper to track whether the in-app daily notice has already been shown today. */
const DAILY_PROMPT_SHOWN_DATE_KEY = '@angelia/daily_prompt_shown_date';

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
	const notification = response.notification;
	const data = notification.request.content.data as Record<string, string> | undefined;
	const type = data?.type;
	const identifier = notification.request.identifier;

	if (identifier === NOTIFICATION_ID || identifier === WIND_DOWN_NOTIFICATION_ID) {
		const promptIndex = parseInt((data?.promptIndex as string) ?? '0', 10);
		const followUp = identifier === WIND_DOWN_NOTIFICATION_ID
			? getFollowUpForWindDown(promptIndex)
			: getFollowUpForPrompt(promptIndex);
		router.push({
			pathname: '/(protected)/post/new',
			params: { existingText: followUp },
		});
	} else if (type === 'join_channel_request') {
		const joinRequestId = data?.joinRequestId;
		if (joinRequestId) {
			router.push({ pathname: '/(protected)/join-request/[id]', params: { id: joinRequestId } });
		} else {
			router.push('/(protected)/notifications');
		}
	} else if (type === 'join_channel_accepted') {
		const channelName = data?.channelName ?? '';
		router.push({ pathname: '/(protected)/channel-accepted', params: { channelName } });
	} else if (type === 'connection_request') {
		const requestId = data?.connectionRequestId;
		if (requestId) {
			router.push({ pathname: '/(protected)/connection-request/[id]', params: { id: requestId } });
		} else {
			router.push('/(protected)/notifications');
		}
	} else if (type === 'connection_accepted') {
		router.push('/(protected)/my-people');
	} else if (type === 'big_news_post') {
		const postId = data?.postId;
		if (postId) {
			router.push({ pathname: '/(protected)/post/[id]', params: { id: postId } });
		}
	} else if (type === 'private_note') {
		const postId = data?.postId;
		if (postId) {
			router.push({ pathname: '/(protected)/private-notes/[postId]', params: { postId } });
		}
	}
});

function NavigationLayout() {
	const { resolvedTheme, theme } = useTheme();

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
