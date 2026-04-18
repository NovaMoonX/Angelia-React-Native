import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

export interface CheckboxGroupItem {
  id: string;
  label: string;
}

interface CheckboxGroupProps {
  /** Group header label. */
  label: string;
  /** Optional emoji shown before the label in the group header. */
  emoji?: string;
  items: CheckboxGroupItem[];
  /** The globally-selected IDs (from the parent's filter state). */
  selectedIds: string[];
  onToggleItem: (id: string) => void;
  /**
   * Called when the group header checkbox is tapped.
   * `select=true` → select all items in the group.
   * `select=false` → deselect all items in the group.
   */
  onToggleGroup: (ids: string[], select: boolean) => void;
  /**
   * When `false`, the select-all group header is hidden and items are
   * rendered without indentation — useful for flat lists.
   * Defaults to `true`.
   */
  grouped?: boolean;
}

type CheckState = 'checked' | 'indeterminate' | 'unchecked';

export function CheckboxGroup({
  label,
  emoji,
  items,
  selectedIds,
  onToggleItem,
  onToggleGroup,
  grouped = true,
}: CheckboxGroupProps) {
  const { theme } = useTheme();

  const ids = items.map((item) => item.id);
  const selectedCount = ids.filter((id) => selectedIds.includes(id)).length;
  const allSelected = selectedCount === items.length && items.length > 0;
  const someSelected = selectedCount > 0 && !allSelected;

  const checkState: CheckState = allSelected
    ? 'checked'
    : someSelected
    ? 'indeterminate'
    : 'unchecked';

  const handleGroupToggle = () => {
    // Indeterminate behaves like unchecked → select all
    onToggleGroup(ids, !allSelected);
  };

  return (
    <View>
      {/* Group header — select-all checkbox (omitted when grouped=false) */}
      {grouped && (
        <Pressable
          onPress={handleGroupToggle}
          style={styles.groupRow}
          accessibilityRole="checkbox"
          accessibilityState={{
            checked:
              checkState === 'checked'
                ? true
                : checkState === 'indeterminate'
                ? 'mixed'
                : false,
          }}
        >
          <GroupCheckbox checkState={checkState} primaryColor={theme.primary} borderColor={theme.border} />
          {emoji != null && <Text style={styles.emoji}>{emoji}</Text>}
          <Text style={[styles.groupLabel, { color: theme.foreground }]} numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
      )}

      {/* Individual items */}
      {items.map((item) => {
        const isSelected = selectedIds.includes(item.id);
        return (
          <Pressable
            key={item.id}
            onPress={() => onToggleItem(item.id)}
            style={styles.itemRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
          >
            {grouped && <View style={styles.itemIndent} />}
            <ItemCheckbox isSelected={isSelected} primaryColor={theme.primary} borderColor={theme.border} />
            <Text style={[styles.itemLabel, { color: theme.foreground }]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Small sub-components ──────────────────────────────────────────────────

function GroupCheckbox({
  checkState,
  primaryColor,
  borderColor,
}: {
  checkState: CheckState;
  primaryColor: string;
  borderColor: string;
}) {
  const active = checkState !== 'unchecked';
  return (
    <View
      style={[
        styles.checkbox,
        {
          borderColor: active ? primaryColor : borderColor,
          backgroundColor: active ? primaryColor : 'transparent',
        },
      ]}
    >
      {checkState === 'checked' && <Feather name="check" size={11} color="#FFFFFF" />}
      {checkState === 'indeterminate' && <View style={styles.indeterminateDash} />}
    </View>
  );
}

function ItemCheckbox({
  isSelected,
  primaryColor,
  borderColor,
}: {
  isSelected: boolean;
  primaryColor: string;
  borderColor: string;
}) {
  return (
    <View
      style={[
        styles.checkbox,
        {
          borderColor: isSelected ? primaryColor : borderColor,
          backgroundColor: isSelected ? primaryColor : 'transparent',
        },
      ]}
    >
      {isSelected && <Feather name="check" size={11} color="#FFFFFF" />}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const CHECKBOX_SIZE = 20;
// Items are indented so their checkbox sits under the group label (past checkbox + gap)
const ITEM_INDENT = CHECKBOX_SIZE + 10;

const styles = StyleSheet.create({
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  indeterminateDash: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  emoji: {
    fontSize: 14,
  },
  groupLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  itemIndent: {
    width: ITEM_INDENT,
  },
  itemLabel: {
    fontSize: 14,
    flex: 1,
  },
});
