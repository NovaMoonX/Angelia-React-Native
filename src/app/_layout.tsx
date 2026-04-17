import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import { router } from 'expo-router';
import notifee, { EventType } from '@notifee/react-native';
import { store } from '@/store';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { ActionModalProvider } from '@/providers/ActionModalProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useTheme } from '@/hooks/useTheme';
import { NOTIFICATION_ID, getFollowUpForPrompt } from '@/services/notifications';

// Register the Notifee background event handler at module level.
// This fires when the user taps a notification while the app is suspended in the
// background. The imperative `router` from expo-router is available at this point
// because the JS engine (and therefore expo-router) is already running.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS && detail.notification?.id === NOTIFICATION_ID) {
    const promptIndex = parseInt(
      (detail.notification.data?.promptIndex as string) ?? '0',
      10,
    );
    const followUp = getFollowUpForPrompt(promptIndex);
    router.push({
      pathname: '/(protected)/post/new',
      params: { existingText: followUp },
    });
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
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="about" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen
          name="complete-profile"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="verify-email"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="join-channel"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="scan-qr"
          options={{ headerShown: false, animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="(protected)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="+not-found"
          options={{ title: 'Not Found' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ReduxProvider store={store}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary
            fallback={null}
          >
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
  );
}
