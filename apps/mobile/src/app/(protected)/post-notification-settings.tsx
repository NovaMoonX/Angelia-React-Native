import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { createDefaultCirclePostNotificationSettings } from '@/models/constants';
import type { Channel, CirclePostNotificationSettings } from '@/models/types';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { resolveConnectionDisplayName } from '@/lib/user/user.utils';
import { saveNotificationSettings } from '@/store/actions/notificationActions';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectAllChannels } from '@/store/slices/channelsSlice';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';

interface CircleRowOption {
  key: keyof CirclePostNotificationSettings;
  emoji: string;
  title: string;
  description: string;
}

const CIRCLE_ROW_OPTIONS: CircleRowOption[] = [
  {
    key: 'bigNewsEnabled',
    emoji: '🔔',
    title: 'Big News',
    description: 'Big life updates in this Circle.',
  },
  {
    key: 'worthKnowingEnabled',
    emoji: '⭐',
    title: 'Worth Knowing',
    description: 'Important updates that are not quite big-news level.',
  },
  {
    key: 'everydayEnabled',
    emoji: '📅',
    title: 'Everyday Update',
    description: 'Everyday check-ins and lighter updates.',
  },
  {
    key: 'withAttachmentsEnabled',
    emoji: '📎',
    title: 'Post With Attachments',
    description: 'Any new post in this Circle that includes photos or videos.',
  },
];

interface GroupedCircleSettings {
  ownerId: string;
  ownerLabel: string;
  circles: Array<{
    channel: Channel;
    displayName: string;
    subtitle: string;
  }>;
}

export default function PostNotificationSettingsScreen() {
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const currentUser = useAppSelector((state) => {
    return state.users.currentUser;
  });
  const allChannels = useAppSelector(selectAllChannels);
  const usersById = useAppSelector(selectAllUsersMapById);
  const nicknamesMap = useAppSelector((state) => state.connectionNicknames.nicknames);
  const notificationSettings = useAppSelector((state) => {
    return state.users.currentUserNotificationSettings;
  });

  const getCircleSettings = useCallback(
    (channelId: string): CirclePostNotificationSettings => {
      return {
        ...createDefaultCirclePostNotificationSettings(),
        ...(notificationSettings?.postByCircle?.[channelId] ?? {}),
      };
    },
    [notificationSettings?.postByCircle],
  );

  const groupedCircles = useMemo((): GroupedCircleSettings[] => {
    if (!currentUser) return [];

    const involved = allChannels.filter((channel) => {
      return channel.ownerId !== currentUser.id && channel.subscribers.includes(currentUser.id);
    });

    const grouped = new Map<string, GroupedCircleSettings>();

    for (const channel of involved) {
      const owner = usersById[channel.ownerId];
      const ownerLabel = resolveConnectionDisplayName(
        channel.ownerId,
        owner,
        currentUser.id,
        nicknamesMap,
        'first-last-initial',
      );
      const existing = grouped.get(channel.ownerId) ?? {
        ownerId: channel.ownerId,
        ownerLabel,
        circles: [],
      };

      const displayName = channel.isDaily === true
        ? resolveConnectionDisplayName(
            channel.ownerId,
            owner,
            currentUser.id,
            nicknamesMap,
            'first-last-initial',
          )
        : channel.name;

      existing.circles.push({
        channel,
        displayName,
        subtitle: channel.isDaily === true ? 'Daily Circle' : 'Custom Circle',
      });

      grouped.set(channel.ownerId, existing);
    }

    return Array.from(grouped.values())
      .map((group) => {
        const nextCircles = [...group.circles].sort((a, b) => {
          if (a.channel.isDaily === true && b.channel.isDaily !== true) return -1;
          if (a.channel.isDaily !== true && b.channel.isDaily === true) return 1;
          return a.displayName.localeCompare(b.displayName);
        });
        return {
          ...group,
          circles: nextCircles,
        };
      })
      .sort((a, b) => {
        return a.ownerLabel.localeCompare(b.ownerLabel);
      });
  }, [allChannels, currentUser, usersById, nicknamesMap]);

  const handleToggleAll = useCallback(
    async (channelId: string) => {
      const current = getCircleSettings(channelId);
      const allOn =
        current.bigNewsEnabled &&
        current.worthKnowingEnabled &&
        current.everydayEnabled &&
        current.withAttachmentsEnabled;
      const nextSettings: CirclePostNotificationSettings = allOn
        ? { bigNewsEnabled: true, worthKnowingEnabled: false, everydayEnabled: false, withAttachmentsEnabled: false }
        : { bigNewsEnabled: true, worthKnowingEnabled: true, everydayEnabled: true, withAttachmentsEnabled: true };
      try {
        await dispatch(
          saveNotificationSettings({ postByCircle: { [channelId]: nextSettings } }),
        ).unwrap();
      } catch {
        addToast({ type: 'error', title: 'Could not update Circle notifications' });
      }
    },
    [addToast, dispatch, getCircleSettings],
  );

  const handleToggleGroupAll = useCallback(
    async (group: GroupedCircleSettings) => {
      const isGroupAllOn = group.circles.every((entry) => {
        const s = getCircleSettings(entry.channel.id);
        return s.bigNewsEnabled && s.worthKnowingEnabled && s.everydayEnabled && s.withAttachmentsEnabled;
      });
      const nextPostByCircle: Record<string, CirclePostNotificationSettings> = {};
      for (const entry of group.circles) {
        nextPostByCircle[entry.channel.id] = isGroupAllOn
          ? { bigNewsEnabled: true, worthKnowingEnabled: false, everydayEnabled: false, withAttachmentsEnabled: false }
          : { bigNewsEnabled: true, worthKnowingEnabled: true, everydayEnabled: true, withAttachmentsEnabled: true };
      }
      try {
        await dispatch(
          saveNotificationSettings({ postByCircle: nextPostByCircle }),
        ).unwrap();
      } catch {
        addToast({ type: 'error', title: 'Could not update Circle notifications' });
      }
    },
    [addToast, dispatch, getCircleSettings],
  );

  const handleToggle = useCallback(
    async (channelId: string, key: keyof CirclePostNotificationSettings) => {
      const currentSettings = getCircleSettings(channelId);
      const nextSettings = {
        ...currentSettings,
        [key]: !currentSettings[key],
      };

      try {
        await dispatch(
          saveNotificationSettings({
            postByCircle: {
              [channelId]: nextSettings,
            },
          }),
        ).unwrap();
      } catch {
        addToast({ type: 'error', title: 'Could not update Circle notifications' });
      }
    },
    [addToast, dispatch, getCircleSettings],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader title='Circle Post Notifications' />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🔔</Text>
          <Text style={[styles.heroSubtitle, { color: theme.mutedForeground }]}> 
            Choose which posts should ping you in each Circle. Big News is on by default.
          </Text>
        </View>

        {groupedCircles.map((group) => {
          return (
            <View key={group.ownerId} style={styles.groupWrap}>
              <View style={styles.ownerHeaderRow}>
                <Text style={[styles.ownerTitle, { color: theme.mutedForeground }]}> 
                  {`${group.ownerLabel}'s Circles`}
                </Text>
                {notificationSettings ? (
                  <Switch
                    value={group.circles.every((entry) => {
                      const s = getCircleSettings(entry.channel.id);
                      return s.bigNewsEnabled && s.worthKnowingEnabled && s.everydayEnabled && s.withAttachmentsEnabled;
                    })}
                    onValueChange={() => { void handleToggleGroupAll(group); }}
                    trackColor={{ false: theme.muted, true: theme.primary }}
                    thumbColor='#FFFFFF'
                  />
                ) : null}
              </View>

              {group.circles.map((entry) => {
                const circleSettings = getCircleSettings(entry.channel.id);
                return (
                  <View
                    key={entry.channel.id}
                    style={[
                      styles.circleCard,
                      { backgroundColor: theme.card, borderColor: theme.border },
                    ]}
                  >
                    <View style={styles.circleHeader}>
                      <Text style={[styles.circleTitle, { color: theme.foreground }]}> 
                        {entry.displayName}
                      </Text>
                      <Text style={[styles.circleSubtitle, { color: theme.mutedForeground }]}> 
                        {entry.subtitle}
                      </Text>
                    </View>

                    {CIRCLE_ROW_OPTIONS.map((option, index) => {
                      return (
                        <View key={option.key}>
                          <View style={styles.row}>
                            <View style={styles.rowLeft}>
                              <Text style={styles.rowEmoji}>{option.emoji}</Text>
                              <View style={styles.rowTextWrap}>
                                <Text style={[styles.rowLabel, { color: theme.foreground }]}> 
                                  {option.title}
                                </Text>
                                <Text style={[styles.rowSub, { color: theme.mutedForeground }]}> 
                                  {option.description}
                                </Text>
                              </View>
                            </View>
                            {notificationSettings ? (
                              <Switch
                                value={circleSettings[option.key]}
                                onValueChange={() => {
                                  void handleToggle(entry.channel.id, option.key);
                                }}
                                trackColor={{ false: theme.muted, true: theme.primary }}
                                thumbColor='#FFFFFF'
                              />
                            ) : (
                              <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>Loading...</Text>
                            )}
                          </View>

                          <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        </View>
                      );
                    })}

                    {/* Enable All toggle at bottom of card */}
                    <View style={styles.row}>
                      <View style={styles.rowLeft}>
                        <Text style={styles.rowEmoji}>🔔</Text>
                        <View style={styles.rowTextWrap}>
                          <Text style={[styles.rowLabel, { color: theme.foreground }]}>Enable All</Text>
                          <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>Turn on all notifications for this Circle</Text>
                        </View>
                      </View>
                      {notificationSettings ? (
                        <Switch
                          value={
                            circleSettings.bigNewsEnabled &&
                            circleSettings.worthKnowingEnabled &&
                            circleSettings.everydayEnabled &&
                            circleSettings.withAttachmentsEnabled
                          }
                          onValueChange={() => { void handleToggleAll(entry.channel.id); }}
                          trackColor={{ false: theme.muted, true: theme.primary }}
                          thumbColor='#FFFFFF'
                        />
                      ) : (
                        <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>Loading...</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        {groupedCircles.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={[styles.emptyTitle, { color: theme.foreground }]}>No Circles Yet</Text>
            <Text style={[styles.emptySub, { color: theme.mutedForeground }]}> 
              Once you join circles, you can fine-tune post notifications here.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 6,
  },
  heroEmoji: {
    fontSize: 34,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320,
  },
  groupWrap: {
    marginTop: 18,
    gap: 10,
  },
  ownerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 2,
  },
  ownerTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  circleCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  circleHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  circleTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  circleSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowEmoji: {
    fontSize: 20,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowSub: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  loadingText: {
    fontSize: 12,
  },
  emptyState: {
    marginHorizontal: 24,
    marginTop: 40,
    alignItems: 'center',
    gap: 4,
  },
  emptyEmoji: {
    fontSize: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
