import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { createDefaultCirclePostNotificationSettings } from '@/models/constants';
import type { CirclePostNotificationSettings } from '@/models/types';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import {
  filterGroupedNotificationCircles,
  groupNotificationChannelsByOwner,
  type GroupedNotificationCircle,
} from '@/lib/notification/notificationCircle.utils';
import { saveNotificationSettings } from '@/store/actions/notificationActions';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectInvolvedNotificationChannels } from '@/store/crossSelectors/notificationCircleSelectors';
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

function getCircleNotificationSummary(settings: CirclePostNotificationSettings): string {
  const enabledLabels = CIRCLE_ROW_OPTIONS
    .filter((option) => {
      return settings[option.key];
    })
    .map((option) => {
      return option.title;
    });

  if (enabledLabels.length === CIRCLE_ROW_OPTIONS.length) {
    return 'All notification types on';
  }
  if (enabledLabels.length === 0) {
    return 'Notifications off';
  }
  return enabledLabels.join(' · ');
}

export default function PostNotificationSettingsScreen() {
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const currentUser = useAppSelector((state) => {
    return state.users.currentUser;
  });
  const involvedChannels = useAppSelector(selectInvolvedNotificationChannels);
  const usersById = useAppSelector(selectAllUsersMapById);
  const notificationSettings = useAppSelector((state) => {
    return state.users.currentUserNotificationSettings;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCircleIds, setCollapsedCircleIds] = useState<Set<string>>(new Set());

  const getCircleSettings = useCallback(
    (channelId: string): CirclePostNotificationSettings => {
      return {
        ...createDefaultCirclePostNotificationSettings(),
        ...(notificationSettings?.postByCircle?.[channelId] ?? {}),
      };
    },
    [notificationSettings?.postByCircle],
  );

  const groupedCircles = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    return groupNotificationChannelsByOwner(involvedChannels, usersById, currentUser.id);
  }, [currentUser, involvedChannels, usersById]);

  const filteredGroups = useMemo(() => {
    return filterGroupedNotificationCircles(groupedCircles, searchQuery);
  }, [groupedCircles, searchQuery]);

  useEffect(() => {
    setCollapsedCircleIds((prev) => {
      const next = new Set(prev);
      groupedCircles.forEach((group) => {
        group.circles.forEach((entry) => {
          next.add(entry.channel.id);
        });
      });
      return next;
    });
  }, [groupedCircles]);

  const toggleCircleExpanded = useCallback((channelId: string) => {
    setCollapsedCircleIds((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }, []);

  const isCircleExpanded = useCallback((channelId: string) => {
    return !collapsedCircleIds.has(channelId);
  }, [collapsedCircleIds]);

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
    async (group: GroupedNotificationCircle) => {
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
        keyboardShouldPersistTaps='handled'
      >
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🔔</Text>
          <Text style={[styles.heroSubtitle, { color: theme.mutedForeground }]}>
            Choose which posts should ping you in each Circle. Big News is on by default.
          </Text>
        </View>

        {groupedCircles.length > 0 && (
          <View style={styles.searchWrap}>
            <Feather name='search' size={16} color={theme.mutedForeground} style={styles.searchIcon} />
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder='Search by person or Circle name'
              style={[styles.searchInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.foreground }]}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8} style={styles.searchClear}>
                <Feather name='x' size={16} color={theme.mutedForeground} />
              </Pressable>
            )}
          </View>
        )}

        {filteredGroups.map((group) => {
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
                const expanded = isCircleExpanded(entry.channel.id);
                const summary = getCircleNotificationSummary(circleSettings);

                return (
                  <View
                    key={entry.channel.id}
                    style={[
                      styles.circleCard,
                      { backgroundColor: theme.card, borderColor: theme.border },
                    ]}
                  >
                    <Pressable
                      onPress={() => {
                        toggleCircleExpanded(entry.channel.id);
                      }}
                      style={styles.circleHeaderPressable}
                    >
                      <View style={styles.circleHeader}>
                        <View style={styles.circleHeaderText}>
                          <Text style={[styles.circleTitle, { color: theme.foreground }]}>
                            {entry.displayName}
                          </Text>
                          <Text style={[styles.circleSubtitle, { color: theme.mutedForeground }]}>
                            {entry.subtitle}
                          </Text>
                          {!expanded && (
                            <Text style={[styles.circleSummary, { color: theme.mutedForeground }]}>
                              {summary}
                            </Text>
                          )}
                        </View>
                        <Feather
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={theme.mutedForeground}
                        />
                      </View>
                    </Pressable>

                    {expanded && CIRCLE_ROW_OPTIONS.map((option) => {
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

                    {expanded && (
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
                    )}
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

        {groupedCircles.length > 0 && filteredGroups.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={[styles.emptyTitle, { color: theme.foreground }]}>No matches</Text>
            <Text style={[styles.emptySub, { color: theme.mutedForeground }]}>
              Try searching by a person&apos;s name or a Circle name.
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
  searchWrap: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingLeft: 38,
    paddingRight: 38,
    fontSize: 15,
  },
  searchClear: {
    position: 'absolute',
    right: 12,
    zIndex: 1,
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
  circleHeaderPressable: {
    width: '100%',
  },
  circleHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  circleHeaderText: {
    flex: 1,
  },
  circleTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  circleSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  circleSummary: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
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
