import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { EMOJI_CATEGORIES, type EmojiCategory } from '@/constants/emojiData';

const NUM_COLUMNS = 8;
const EMOJI_CELL_SIZE = 44;

interface EmojiPickerProps {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

/* ── Individual emoji cell (pure) ───────────────────────────── */
const EmojiCell = memo(function EmojiCell({
  emoji,
  onPress,
}: {
  emoji: string;
  onPress: (emoji: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(emoji)}
      style={styles.emojiCell}
    >
      <Text style={styles.emojiCellText}>{emoji}</Text>
    </Pressable>
  );
});

/* ── Section item used in the outer list ────────────────────── */
type SectionItem = {
  type: 'header';
  key: string;
  title: string;
} | {
  type: 'row';
  key: string;
  emojis: string[];
};

function buildSections(
  categories: EmojiCategory[],
  search: string,
): SectionItem[] {
  const items: SectionItem[] = [];
  const lowerSearch = search.toLowerCase();

  for (const cat of categories) {
    // When searching, show the entire category if the title matches,
    // otherwise only show emojis whose characters include the query.
    const titleMatch = search
      ? cat.title.toLowerCase().includes(lowerSearch)
      : false;

    const emojis = search
      ? titleMatch
        ? cat.emojis
        : cat.emojis.filter((e) => e.toLowerCase().includes(lowerSearch))
      : cat.emojis;

    if (emojis.length === 0) continue;

    items.push({ type: 'header', key: `h-${cat.key}`, title: cat.title });

    // Chunk emojis into rows of NUM_COLUMNS
    for (let i = 0; i < emojis.length; i += NUM_COLUMNS) {
      items.push({
        type: 'row',
        key: `r-${cat.key}-${i}`,
        emojis: emojis.slice(i, i + NUM_COLUMNS),
      });
    }
  }
  return items;
}

/* ── Row renderer (pure) ────────────────────────────────────── */
const EmojiRow = memo(function EmojiRow({
  emojis,
  onPress,
}: {
  emojis: string[];
  onPress: (emoji: string) => void;
}) {
  return (
    <View style={styles.row}>
      {emojis.map((e) => (
        <EmojiCell key={e} emoji={e} onPress={onPress} />
      ))}
    </View>
  );
});

/* ── Main component ─────────────────────────────────────────── */
export function EmojiPicker({ visible, onSelect, onClose }: EmojiPickerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(
    EMOJI_CATEGORIES[0].key,
  );

  const sections = useMemo(() => buildSections(EMOJI_CATEGORIES, search), [search]);

  // When activeCategory changes and search is cleared, scroll to that category
  const pendingScrollRef = React.useRef<string | null>(null);

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji);
    },
    [onSelect],
  );

  const handleCategoryPress = useCallback(
    (catKey: string) => {
      setActiveCategory(catKey);
      if (search) {
        // Clear search first; scroll will happen in the effect below
        pendingScrollRef.current = catKey;
        setSearch('');
      } else {
        // No search active — scroll immediately
        const idx = sections.findIndex(
          (s) => s.type === 'header' && s.key === `h-${catKey}`,
        );
        if (idx >= 0) {
          flatListRef.current?.scrollToIndex({ index: idx, animated: true });
        }
      }
    },
    [sections, search],
  );

  // Handle deferred scroll after search is cleared
  React.useEffect(() => {
    const key = pendingScrollRef.current;
    if (key && !search) {
      pendingScrollRef.current = null;
      const idx = sections.findIndex(
        (s) => s.type === 'header' && s.key === `h-${key}`,
      );
      if (idx >= 0) {
        flatListRef.current?.scrollToIndex({ index: idx, animated: true });
      }
    }
  }, [sections, search]);

  const flatListRef = React.useRef<FlatList<SectionItem>>(null);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => {
      // Headers are 36px, rows are EMOJI_CELL_SIZE
      let offset = 0;
      for (let i = 0; i < index; i++) {
        offset += sections[i]?.type === 'header' ? 36 : EMOJI_CELL_SIZE;
      }
      const length =
        sections[index]?.type === 'header' ? 36 : EMOJI_CELL_SIZE;
      return { length, offset, index };
    },
    [sections],
  );

  const renderItem = useCallback(
    ({ item }: { item: SectionItem }) => {
      if (item.type === 'header') {
        return (
          <Text
            style={[styles.sectionHeader, { color: theme.mutedForeground }]}
          >
            {item.title}
          </Text>
        );
      }
      return <EmojiRow emojis={item.emojis} onPress={handleSelect} />;
    },
    [handleSelect, theme.mutedForeground],
  );

  const keyExtractor = useCallback((item: SectionItem) => item.key, []);

  const handleClose = useCallback(() => {
    setSearch('');
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              paddingBottom: insets.bottom + 8,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View
            style={[styles.sheetHeader, { borderBottomColor: theme.border }]}
          >
            <Text style={[styles.sheetTitle, { color: theme.foreground }]}>
              Pick an emoji
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text
                style={[
                  styles.closeButton,
                  { color: theme.mutedForeground },
                ]}
              >
                ✕
              </Text>
            </Pressable>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by category…"
              placeholderTextColor={theme.mutedForeground}
              style={[
                styles.searchInput,
                {
                  color: theme.foreground,
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
              ]}
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          {/* Category tabs */}
          <View style={styles.categoryBar}>
            {EMOJI_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                onPress={() => handleCategoryPress(cat.key)}
                style={[
                  styles.categoryTab,
                  activeCategory === cat.key && {
                    borderBottomColor: theme.primary,
                    borderBottomWidth: 2,
                  },
                ]}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
              </Pressable>
            ))}
          </View>

          {/* Emoji grid */}
          <FlatList
            ref={flatListRef}
            data={sections}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            initialNumToRender={15}
            maxToRenderPerBatch={20}
            windowSize={7}
            removeClippedSubviews
            onScrollToIndexFailed={() => {}}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 20,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  categoryBar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  categoryIcon: {
    fontSize: 20,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 8,
    height: 36,
    lineHeight: 36,
  },
  row: {
    flexDirection: 'row',
    height: EMOJI_CELL_SIZE,
  },
  emojiCell: {
    width: EMOJI_CELL_SIZE,
    height: EMOJI_CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiCellText: {
    fontSize: 26,
  },
});
