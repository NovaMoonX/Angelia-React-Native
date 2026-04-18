import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as ReduxProvider } from 'react-redux';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { store } from '@/store';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { ActionModalProvider } from '@/providers/ActionModalProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useTheme } from '@/hooks/useTheme';
import { NOTIFICATION_ID, getFollowUpForPrompt } from '@/services/notifications';

// Configure how notifications are presented when the app is in the foreground.
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

// Register a global response handler so that notification taps from
// background / quit states navigate to the appropriate screen.
Notifications.addNotificationResponseReceivedListener((response) => {
	const notification = response.notification;
	const data = notification.request.content.data as Record<string, string> | undefined;
	const type = data?.type;

	if (notification.request.identifier === NOTIFICATION_ID) {
		// Daily prompt notification — navigate to post creation
		const promptIndex = parseInt((data?.promptIndex as string) ?? '0', 10);
		const followUp = getFollowUpForPrompt(promptIndex);
		router.push({
			pathname: '/(protected)/post/new',
			params: { existingText: followUp },
		});
	} else if (type === 'join_channel_request' || type === 'join_channel_accepted') {
		// Channel join notifications — navigate to the notifications screen
		router.push('/(protected)/notifications');
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
