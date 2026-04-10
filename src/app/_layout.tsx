import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '@/store';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { ActionModalProvider } from '@/providers/ActionModalProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useTheme } from '@/hooks/useTheme';

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
        <Stack.Screen name="auth" options={{ title: 'Sign In' }} />
        <Stack.Screen
          name="complete-profile"
          options={{ title: 'Complete Profile', headerBackVisible: false }}
        />
        <Stack.Screen
          name="verify-email"
          options={{ title: 'Verify Email', headerBackVisible: false }}
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
