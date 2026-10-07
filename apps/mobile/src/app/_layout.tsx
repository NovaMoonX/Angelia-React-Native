import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as ReduxProvider } from 'react-redux';
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
} from '@/services/notifications';
import { handleNotificationResponse } from '@/lib/notification/handleNotificationResponse';

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

// Register a global response handler so that notification taps while the app is running
// (foreground or background) navigate to the appropriate screen. Routing lives in
// lib/notification/ so every tap path shares one table.
//
// A tap that cold-starts the app is skipped here until the user's profile is loaded
// (signed out / still loading) and picked up by the cold-start fallback in
// useDataListenerNotifications via getLastNotificationResponseAsync(). The shared
// dedupe claim guarantees only one of the two ever navigates.
Notifications.addNotificationResponseReceivedListener((response) => {
	if (store.getState().users.currentUser == null) {
		return;
	}
	void handleNotificationResponse(response).catch(() => {
		return null;
	});
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
