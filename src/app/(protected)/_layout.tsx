import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAppSelector } from '@/store/hooks';
import { useTheme } from '@/hooks/useTheme';
import { Loading } from '@/components/Loading';
import { DemoModeBanner } from '@/components/DemoModeBanner';
import { DataListenerWrapper } from '@/components/DataListenerWrapper';
import { View } from 'react-native';

export default function ProtectedLayout() {
  const { firebaseUser, loading } = useAuth();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const { theme } = useTheme();

  // Demo mode bypasses all auth checks
  if (!isDemo) {
    if (loading) return <Loading />;

    if (!firebaseUser) {
      return <Redirect href="/auth" />;
    }

    // Profile not loaded yet — could be a new signup or still fetching
    if (!currentUser) {
      return <Redirect href="/complete-profile" />;
    }

    // Signup incomplete
    if (!currentUser.accountProgress.signUpComplete) {
      return <Redirect href="/complete-profile" />;
    }

    // Email not verified
    if (!firebaseUser.emailVerified) {
      return <Redirect href="/verify-email" />;
    }
  }

  return (
    <DataListenerWrapper>
      <View style={{ flex: 1 }}>
        <DemoModeBanner />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.foreground,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: theme.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="feed" options={{ headerShown: false }} />
          <Stack.Screen name="camera" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="gallery" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen
            name="post/new"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="post/[id]"
            options={{ 
              headerShown: true, 
              title: 'Post',
              headerStyle: { backgroundColor: theme.background },
              headerTintColor: theme.foreground,
            }}
          />
          <Stack.Screen name="account" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen
            name="invite/[channelId]/[inviteCode]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="error-fallback"
            options={{ title: 'Error', headerBackVisible: false }}
          />
        </Stack>
      </View>
    </DataListenerWrapper>
  );
}
