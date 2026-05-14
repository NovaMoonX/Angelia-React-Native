import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { saveNotificationSettings } from '@/store/actions/notificationActions';
import { ScreenHeader } from '@/components/ScreenHeader';

export default function PostNotificationSettingsScreen() {
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();

  const notificationSettings = useAppSelector((state) => {
    return state.users.currentUserNotificationSettings;
  });

  const postActivity = notificationSettings?.postActivity;
  const reactionsEnabled = postActivity?.reactionsEnabled !== false;
  const privateNotesEnabled = postActivity?.privateNotesEnabled !== false;
  const conversationMessagesEnabled = postActivity?.conversationMessagesEnabled !== false;

  const handleToggleReactions = useCallback(async () => {
    try {
      await dispatch(
        saveNotificationSettings({
          postActivity: { reactionsEnabled: !reactionsEnabled },
        }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update reaction notifications' });
    }
  }, [dispatch, reactionsEnabled, addToast]);

  const handleTogglePrivateNotes = useCallback(async () => {
    try {
      await dispatch(
        saveNotificationSettings({
          postActivity: { privateNotesEnabled: !privateNotesEnabled },
        }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update private note notifications' });
    }
  }, [dispatch, privateNotesEnabled, addToast]);

  const handleToggleConversationMessages = useCallback(async () => {
    try {
      await dispatch(
        saveNotificationSettings({
          postActivity: { conversationMessagesEnabled: !conversationMessagesEnabled },
        }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update conversation notifications' });
    }
  }, [dispatch, conversationMessagesEnabled, addToast]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader title="Post Notifications" />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={styles.container}
      >
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>✨</Text>
          <Text style={[styles.heroSubtitle, { color: theme.mutedForeground }]}> 
            Choose what kind of activity on your posts should ping you.
          </Text>
        </View>

        <View
          style={[
            styles.group,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowEmoji}>😍</Text>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>Reactions</Text>
                <Text style={[styles.rowSub, { color: theme.mutedForeground }]}> 
                  Get notified when someone reacts to your post.
                </Text>
              </View>
            </View>
            {notificationSettings ? (
              <Switch
                value={reactionsEnabled}
                onValueChange={handleToggleReactions}
                trackColor={{ false: theme.muted, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            ) : (
              <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>Loading…</Text>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowEmoji}>🔒</Text>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>Private Notes</Text>
                <Text style={[styles.rowSub, { color: theme.mutedForeground }]}> 
                  Get notified when someone sends you a private note.
                </Text>
              </View>
            </View>
            {notificationSettings ? (
              <Switch
                value={privateNotesEnabled}
                onValueChange={handleTogglePrivateNotes}
                trackColor={{ false: theme.muted, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            ) : (
              <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>Loading…</Text>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowEmoji}>💬</Text>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>Conversation Messages</Text>
                <Text style={[styles.rowSub, { color: theme.mutedForeground }]}> 
                  Get notified when someone messages on your post conversation.
                </Text>
              </View>
            </View>
            {notificationSettings ? (
              <Switch
                value={conversationMessagesEnabled}
                onValueChange={handleToggleConversationMessages}
                trackColor={{ false: theme.muted, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            ) : (
              <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>Loading…</Text>
            )}
          </View>
        </View>

        <Text style={[styles.footer, { color: theme.mutedForeground }]}> 
          All three are on by default, and you can switch them anytime. 🌟
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 48,
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 6,
  },
  heroEmoji: {
    fontSize: 36,
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 290,
  },
  group: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowEmoji: {
    fontSize: 22,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  loadingText: {
    fontSize: 13,
  },
  footer: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    marginHorizontal: 32,
  },
});
