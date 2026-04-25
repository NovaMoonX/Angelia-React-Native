import React from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { AccountTab } from '@/components/account/AccountTab';
import { MyChannelsTab } from '@/components/account/MyChannelsTab';
import { SubscribedTab } from '@/components/account/SubscribedTab';
import { useAppSelector } from '@/store/hooks';
import { useTheme } from '@/hooks/useTheme';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';

export default function AccountScreen() {
  const { theme } = useTheme();
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab = params.tab ?? 'account';

  if (!currentUser) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.mutedForeground }}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingTop: 8 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Tabs defaultValue={initialTab}>
          <TabsList style={{ marginBottom: 16 }}>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="my-channels">My Circles</TabsTrigger>
            <TabsTrigger value="subscribed">Joined</TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <AccountTab />
          </TabsContent>

          <TabsContent value="my-channels">
            <MyChannelsTab />
          </TabsContent>

          <TabsContent value="subscribed">
            <SubscribedTab />
          </TabsContent>
        </Tabs>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
