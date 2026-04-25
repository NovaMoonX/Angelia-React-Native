import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { completeTask } from '@/store/actions/taskActions';
import type { AppTask } from '@/models/types';

/** Returns icon name, title, description and optional primary CTA label for a task. */
function taskMeta(task: AppTask): {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  desc: string;
  ctaLabel?: string;
} {
  switch (task.type) {
    case 'invite_to_circle':
      return {
        icon: 'user-plus',
        title: `Invite someone to ${task.channelName}`,
        desc: 'Circles are better with people in them! Share your invite code so someone can join.',
        ctaLabel: 'Share Invite',
      };
    case 'set_fun_fact':
      return {
        icon: 'user',
        title: 'Add your bio',
        desc: "Let your people know who you are! Add a fun fact to your profile so friends can learn a little more about you.",
        ctaLabel: 'Go to Profile',
      };
    case 'set_status':
      return {
        icon: 'smile',
        title: 'Set your first status',
        desc: "Let people know what's going on with you! Tap the + button on the feed and choose Status.",
        ctaLabel: 'Go to Feed',
      };
    case 'create_custom_circle':
      return {
        icon: 'circle',
        title: 'Create a custom Circle',
        desc: "Custom Circles let you share specific updates with specific people. Head to My Circles to create one whenever you're ready.",
        ctaLabel: 'My Circles',
      };
    case 'make_first_post':
      return {
        icon: 'edit-2',
        title: 'Make your first post! 🚀',
        desc: "You're all set — now share something with your Daily Circle! It doesn't have to be perfect. Even a quick hello goes a long way. 💛",
        ctaLabel: 'Write a Post',
      };
  }
}

export default function TasksScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const tasks = useAppSelector((state) => state.tasks.items);
  const channels = useAppSelector((state) => state.channels.items);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleComplete = useCallback(
    async (task: AppTask) => {
      setLoadingId(task.id);
      try {
        await dispatch(completeTask(task.id)).unwrap();
        addToast({ type: 'success', title: 'Task done! ✅' });
      } catch {
        addToast({ type: 'error', title: 'Could not complete task. Try again.' });
      } finally {
        setLoadingId(null);
      }
    },
    [dispatch, addToast],
  );

  const handleShareInvite = useCallback(
    async (task: AppTask) => {
      if (task.type !== 'invite_to_circle') return;
      const channel = channels.find((c) => c.id === task.channelId);
      if (!channel?.inviteCode) {
        addToast({ type: 'warning', title: "Couldn't find that Circle's invite code." });
        return;
      }
      try {
        await Share.share({
          message: `Join my "${channel.name}" Circle on Angelia! 🎉\n\nUse invite code: ${channel.inviteCode}`,
          title: `Join ${channel.name} on Angelia`,
        });
        // Mark done after a successful share attempt
        await dispatch(completeTask(task.id)).unwrap();
      } catch {
        // User cancelled share — no-op
      }
    },
    [channels, dispatch, addToast],
  );

  /** Handles the primary CTA for non-invite tasks (navigates to the relevant screen). */
  const handlePrimaryCta = useCallback(
    async (task: AppTask) => {
      switch (task.type) {
        case 'set_fun_fact':
          router.push('/(protected)/account');
          break;
        case 'create_custom_circle':
          router.push({ pathname: '/(protected)/account', params: { tab: 'my-channels' } });
          break;
        case 'set_status':
          router.push('/(protected)/feed');
          break;
        case 'make_first_post':
          router.push('/(protected)/post/new');
          break;
        default:
          break;
      }
    },
    [router],
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      {tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={[styles.emptyTitle, { color: theme.foreground }]}>
            All caught up!
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.mutedForeground }]}>
            You have no pending tasks right now.
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
            {tasks.length} TASK{tasks.length !== 1 ? 'S' : ''} PENDING
          </Text>
          {tasks.map((task) => {
            const meta = taskMeta(task);
            return (
              <Card key={task.id} style={[styles.card, { borderColor: theme.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: theme.secondary }]}>
                    <Feather name={meta.icon} size={20} color={theme.primary} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, { color: theme.foreground }]}>
                      {meta.title}
                    </Text>
                    <Text style={[styles.cardDesc, { color: theme.mutedForeground }]}>
                      {meta.desc}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  {meta.ctaLabel && (
                    <Button
                      onPress={() =>
                        task.type === 'invite_to_circle'
                          ? handleShareInvite(task)
                          : handlePrimaryCta(task)
                      }
                      style={{ flex: 1 }}
                      size="sm"
                    >
                      {meta.ctaLabel}
                    </Button>
                  )}
                  {task.type !== 'make_first_post' && (
                    <Pressable
                      onPress={() => handleComplete(task)}
                      style={[styles.dismissButton, { borderColor: theme.border }]}
                      disabled={loadingId === task.id}
                    >
                      <Text style={[styles.dismissText, { color: theme.mutedForeground }]}>
                        {loadingId === task.id ? '…' : 'Dismiss'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </Card>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  card: {
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  dismissButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
