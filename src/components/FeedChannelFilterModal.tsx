import React, { useState, useMemo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { useTheme } from '@/hooks/useTheme';
import { useAppSelector } from '@/store/hooks';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import type { Channel } from '@/models/types';

export type ChannelFilterMode = 'all' | 'others' | 'specific';

export interface ChannelFilterState {
  mode: ChannelFilterMode;
  specificIds: string[];
}

interface FeedChannelFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: ChannelFilterState;
  onApply: (value: ChannelFilterState) => void;
  channels: Channel[];
  currentUserId?: string;
}

export function FeedChannelFilterModal({
  isOpen,
  onClose,
  value,
  onApply,
  channels,
  currentUserId,
}: FeedChannelFilterModalProps) {
  const { theme } = useTheme();
  const usersById = useAppSelector(selectAllUsersMapById);

  const [localFilter, setLocalFilter] = useState<ChannelFilterState>(value);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalFilter(value);
      setSearchQuery('');
    }
    // Intentionally only sync when the modal opens — we don't want parent
    // value changes to clobber in-progress edits while the modal is open.
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const dailyChannels = useMemo(
    () => channels.filter((ch) => ch.isDaily === true),
    [channels],
  );
  const regularChannels = useMemo(
    () => channels.filter((ch) => !ch.isDaily),
    [channels],
  );
  const showSearch = channels.length >= 5;

  const filteredDaily = useMemo(() => {
    if (!searchQuery.trim()) return dailyChannels;
    const q = searchQuery.toLowerCase();
    return dailyChannels.filter((ch) => {
      const owner = usersById[ch.ownerId];
      const name = owner ? `${owner.firstName} ${owner.lastName[0]}.` : ch.name;
      return name.toLowerCase().includes(q);
    });
  }, [dailyChannels, searchQuery, usersById]);

  const filteredRegular = useMemo(() => {
    if (!searchQuery.trim()) return regularChannels;
    const q = searchQuery.toLowerCase();
    return regularChannels.filter((ch) => ch.name.toLowerCase().includes(q));
  }, [regularChannels, searchQuery]);

  const handleRadioSelect = (mode: 'all' | 'others') => {
    setLocalFilter({ mode, specificIds: [] });
  };

  const handleChannelToggle = (channelId: string) => {
    setLocalFilter((prev) => {
      const currentIds = prev.mode === 'specific' ? prev.specificIds : [];
      const isSelected = currentIds.includes(channelId);
      const newIds = isSelected
        ? currentIds.filter((id) => id !== channelId)
        : [...currentIds, channelId];
      // If all deselected, revert to 'all'
      if (newIds.length === 0) return { mode: 'all', specificIds: [] };
      return { mode: 'specific', specificIds: newIds };
    });
  };

  const handleApply = () => {
    onApply(localFilter);
    onClose();
  };

  const noResults =
    filteredDaily.length === 0 &&
    filteredRegular.length === 0 &&
    searchQuery.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Filter Channels">
      {/* Radio — scope */}
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Scope</Text>
      {(['all', 'others'] as const).map((mode) => {
        const isActive = localFilter.mode === mode;
        return (
          <Pressable key={mode} onPress={() => handleRadioSelect(mode)} style={styles.radioRow}>
            <View
              style={[
                styles.radioCircle,
                { borderColor: isActive ? theme.primary : theme.border },
              ]}
            >
              {isActive && (
                <View style={[styles.radioFill, { backgroundColor: theme.primary }]} />
              )}
            </View>
            <Text style={[styles.radioLabel, { color: theme.foreground }]}>
              {mode === 'all' ? 'All Channels' : "Others' Channels"}
            </Text>
          </Pressable>
        );
      })}

      <Separator />

      {/* Specific channel picker */}
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        Or pick specific channels
      </Text>

      {showSearch && (
        <View
          style={[
            styles.searchRow,
            { borderColor: theme.border, backgroundColor: theme.background },
          ]}
        >
          <Feather name="search" size={14} color={theme.mutedForeground} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search channels…"
            placeholderTextColor={theme.mutedForeground}
            style={[styles.searchInput, { color: theme.foreground }]}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Feather name="x" size={14} color={theme.mutedForeground} />
            </Pressable>
          )}
        </View>
      )}

      {/* Daily channels group */}
      {filteredDaily.length > 0 && (
        <>
          <View style={styles.groupHeader}>
            <Text style={styles.groupEmoji}>📅</Text>
            <Text style={[styles.groupLabel, { color: theme.mutedForeground }]}>
              Daily Channels
            </Text>
          </View>
          {filteredDaily.map((ch) => (
            <ChannelRow
              key={ch.id}
              channel={ch}
              isSelected={
                localFilter.mode === 'specific' &&
                localFilter.specificIds.includes(ch.id)
              }
              isOwn={ch.ownerId === currentUserId}
              onToggle={handleChannelToggle}
            />
          ))}
        </>
      )}

      {/* Regular channels group */}
      {filteredRegular.length > 0 && (
        <>
          {filteredDaily.length > 0 && (
            <View style={styles.groupHeader}>
              <Text style={styles.groupEmoji}>📢</Text>
              <Text style={[styles.groupLabel, { color: theme.mutedForeground }]}>
                Channels
              </Text>
            </View>
          )}
          {filteredRegular.map((ch) => (
            <ChannelRow
              key={ch.id}
              channel={ch}
              isSelected={
                localFilter.mode === 'specific' &&
                localFilter.specificIds.includes(ch.id)
              }
              isOwn={ch.ownerId === currentUserId}
              onToggle={handleChannelToggle}
            />
          ))}
        </>
      )}

      {noResults && (
        <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
          No channels match your search.
        </Text>
      )}

      <Button onPress={handleApply} style={styles.applyButton}>
        Apply
      </Button>
    </Modal>
  );
}

interface ChannelRowProps {
  channel: Channel;
  isSelected: boolean;
  isOwn: boolean;
  onToggle: (id: string) => void;
}

function ChannelRow({ channel, isSelected, isOwn, onToggle }: ChannelRowProps) {
  const { theme } = useTheme();
  const usersById = useAppSelector(selectAllUsersMapById);
  const displayName = useMemo(() => {
    if (!channel.isDaily) return channel.name;
    const owner = usersById[channel.ownerId];
    return owner ? `${owner.firstName} ${owner.lastName}` : channel.name;
  }, [channel, usersById]);

  return (
    <Pressable onPress={() => onToggle(channel.id)} style={styles.channelRow}>
      <View
        style={[
          styles.checkbox,
          {
            borderColor: isSelected ? theme.primary : theme.border,
            backgroundColor: isSelected ? theme.primary : 'transparent',
          },
        ]}
      >
        {isSelected && <Feather name="check" size={11} color="#FFFFFF" />}
      </View>
      <Text
        style={[styles.channelName, { color: theme.foreground }]}
        numberOfLines={1}
      >
        {displayName}
      </Text>
      {isOwn && (
        <View style={[styles.ownBadge, { backgroundColor: theme.secondary }]}>
          <Text style={[styles.ownBadgeText, { color: theme.secondaryForeground }]}>
            yours
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  groupEmoji: {
    fontSize: 14,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  channelName: {
    fontSize: 15,
    flex: 1,
  },
  ownBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  ownBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  applyButton: {
    marginTop: 20,
  },
});
