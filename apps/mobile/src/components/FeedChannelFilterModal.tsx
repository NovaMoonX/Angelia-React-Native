import React, { useState, useMemo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { CheckboxGroup } from '@/components/ui/CheckboxGroup';
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
      const name = owner
        ? `${owner.firstName} ${owner.lastName}`.toLowerCase()
        : ch.name.toLowerCase();
      return name.includes(q);
    });
  }, [dailyChannels, searchQuery, usersById]);

  const filteredRegular = useMemo(() => {
    if (!searchQuery.trim()) return regularChannels;
    const q = searchQuery.toLowerCase();
    return regularChannels.filter((ch) => {
      if (ch.name.toLowerCase().includes(q)) return true;
      const owner = usersById[ch.ownerId];
      return owner
        ? `${owner.firstName} ${owner.lastName}`.toLowerCase().includes(q)
        : false;
    });
  }, [regularChannels, searchQuery, usersById]);

  // Daily items sorted: current user first, then by owner name
  const filteredDailyItems = useMemo(() => {
    return [...filteredDaily]
      .sort((a, b) => {
        if (a.ownerId === currentUserId) return -1;
        if (b.ownerId === currentUserId) return 1;
        const ownerA = usersById[a.ownerId];
        const ownerB = usersById[b.ownerId];
        return (ownerA ? `${ownerA.firstName} ${ownerA.lastName}` : '').localeCompare(
          ownerB ? `${ownerB.firstName} ${ownerB.lastName}` : '',
        );
      })
      .map((ch) => {
        const owner = usersById[ch.ownerId];
        const label =
          ch.ownerId === currentUserId
            ? 'Yours'
            : owner
            ? `${owner.firstName} ${owner.lastName[0]}.`
            : ch.name;
        return { id: ch.id, label };
      });
  }, [filteredDaily, usersById, currentUserId]);

  // Regular channels grouped by owner: current user's group first, then alphabetical
  const filteredRegularGroups = useMemo(() => {
    const groupMap = new Map<string, Channel[]>();
    for (const ch of filteredRegular) {
      const existing = groupMap.get(ch.ownerId) ?? [];
      groupMap.set(ch.ownerId, [...existing, ch]);
    }
    return Array.from(groupMap.entries())
      .map(([ownerId, chs]) => {
        const owner = usersById[ownerId];
        const label =
          ownerId === currentUserId
            ? 'Yours'
            : owner
            ? `${owner.firstName} ${owner.lastName[0]}.`
            : 'Unknown';
        return { ownerId, label, items: chs.map((ch) => ({ id: ch.id, label: ch.name })) };
      })
      .sort((a, b) => {
        if (a.ownerId === currentUserId) return -1;
        if (b.ownerId === currentUserId) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [filteredRegular, usersById, currentUserId]);

  const selectedIds = localFilter.mode === 'specific' ? localFilter.specificIds : [];

  const handleRadioSelect = (mode: 'all' | 'others') => {
    setLocalFilter({ mode, specificIds: [] });
  };

  const handleToggleItem = (channelId: string) => {
    setLocalFilter((prev) => {
      const currentIds = prev.mode === 'specific' ? prev.specificIds : [];
      const isSelected = currentIds.includes(channelId);
      const newIds = isSelected
        ? currentIds.filter((id) => id !== channelId)
        : [...currentIds, channelId];
      if (newIds.length === 0) return { mode: 'all', specificIds: [] };
      return { mode: 'specific', specificIds: newIds };
    });
  };

  const handleToggleGroup = (ids: string[], select: boolean) => {
    setLocalFilter((prev) => {
      const currentIds = prev.mode === 'specific' ? prev.specificIds : [];
      const newIds = select
        ? [...new Set([...currentIds, ...ids])]
        : currentIds.filter((id) => !ids.includes(id));
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
    <Modal isOpen={isOpen} onClose={onClose} title="Filter Circles">
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
              {mode === 'all' ? 'All Circles' : "Others' Circles"}
            </Text>
          </Pressable>
        );
      })}

      <Separator />

      {/* Specific channel picker */}
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
        Or pick specific circles
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
            placeholder="Search circles…"
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

      {/* Daily channels — flat list with a section label */}
      {filteredDailyItems.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>📅</Text>
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground, marginBottom: 0 }]}>
              Daily Circles
            </Text>
          </View>
          <CheckboxGroup
            label="Daily Circles"
            items={filteredDailyItems}
            selectedIds={selectedIds}
            onToggleItem={handleToggleItem}
            onToggleGroup={handleToggleGroup}
            grouped={false}
          />
        </>
      )}

      {/* Regular channels — one group per owner */}
      {filteredRegularGroups.length > 0 && (
        <>
          {filteredDailyItems.length > 0 && <Separator style={{ marginVertical: 8 }} />}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>📣</Text>
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground, marginBottom: 0 }]}>
              Circles
            </Text>
          </View>
          {filteredRegularGroups.map(({ ownerId, label, items }) => (
            <CheckboxGroup
              key={ownerId}
              label={label}
              items={items}
              selectedIds={selectedIds}
              onToggleItem={handleToggleItem}
              onToggleGroup={handleToggleGroup}
            />
          ))}
        </>
      )}

      {noResults && (
        <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
          No circles match your search.
        </Text>
      )}

      <Button onPress={handleApply} style={styles.applyButton}>
        Apply
      </Button>
    </Modal>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionEmoji: {
    fontSize: 14,
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
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  applyButton: {
    marginTop: 20,
  },
});

