import React, { useState, useMemo } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface SelectOption {
  text: string;
  value: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** When true, adds a search input at the top of the options list. */
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function Select({ options, value, onChange, placeholder, searchable, searchPlaceholder }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { theme } = useTheme();
  const selectedOption = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.text.toLowerCase().includes(q));
  }, [options, query, searchable]);

  function handleOpen() {
    setQuery('');
    setIsOpen(true);
  }

  return (
    <>
      <Pressable
        onPress={handleOpen}
        style={[styles.trigger, { borderColor: theme.border, backgroundColor: theme.background }]}
      >
        <Text
          style={[
            styles.triggerText,
            { color: selectedOption ? theme.foreground : theme.mutedForeground },
          ]}
          numberOfLines={1}
        >
          {selectedOption?.text || placeholder || 'Select...'}
        </Text>
        <Feather name="chevron-down" size={16} color={theme.mutedForeground} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View
            style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border }]}
            onStartShouldSetResponder={() => true}
          >
            {searchable && (
              <View style={[styles.searchRow, { borderBottomColor: theme.border }]}>
                <Feather name="search" size={14} color={theme.mutedForeground} style={styles.searchIcon} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={searchPlaceholder ?? 'Search…'}
                  placeholderTextColor={theme.mutedForeground}
                  style={[styles.searchInput, { color: theme.foreground }]}
                  autoFocus
                  autoCorrect={false}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <Feather name="x" size={14} color={theme.mutedForeground} />
                  </Pressable>
                )}
              </View>
            )}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
                  No results
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setIsOpen(false);
                  }}
                  style={[
                    styles.option,
                    item.value === value && { backgroundColor: theme.secondary },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: theme.foreground },
                      item.value === value && { fontWeight: '600' },
                    ]}
                  >
                    {item.text}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerText: {
    fontSize: 14,
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    padding: 32,
  },
  dropdown: {
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 360,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 14,
  },
});
