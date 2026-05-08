import React, { useState, useCallback, useMemo, memo, useRef } from 'react';
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
const HEADER_HEIGHT = 36;

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
  const flatListRef = useRef<FlatList<SectionItem>>(null);
  const pendingScrollCategoryRef = useRef<string | null>(null);

  // Build sections and pre-compute cumulative offsets for O(1) getItemLayout
  const { sections, offsets, categoryOffsets } = useMemo(() => {
    const items = buildSections(EMOJI_CATEGORIES, search);
    const cumulativeOffsets: number[] = [];
    const catOffsets: Record<string, number> = {};
    let offset = 0;
    for (let i = 0; i < items.length; i++) {
      cumulativeOffsets.push(offset);
      if (items[i].type === 'header') {
        const catKey = items[i].key.slice(2);
        catOffsets[catKey] = offset;
      }
      offset += items[i].type === 'header' ? HEADER_HEIGHT : EMOJI_CELL_SIZE;
    }
    return { sections: items, offsets: cumulativeOffsets, categoryOffsets: catOffsets };
  }, [search]);

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
        pendingScrollCategoryRef.current = catKey;
        setSearch('');
      } else {
        const offset = categoryOffsets[catKey];
        if (offset !== undefined) {
          flatListRef.current?.scrollToOffset({ offset, animated: false });
        }
      }
    },
    [categoryOffsets, search],
  );

  // Handle deferred scroll after search is cleared
  React.useEffect(() => {
    const key = pendingScrollCategoryRef.current;
    if (key && !search) {
      pendingScrollCategoryRef.current = null;
      const offset = categoryOffsets[key];
      if (offset !== undefined) {
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset, animated: false });
        });
      }
    }
  }, [categoryOffsets, search]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: sections[index]?.type === 'header' ? HEADER_HEIGHT : EMOJI_CELL_SIZE,
      offset: offsets[index] ?? 0,
      index,
    }),
    [sections, offsets],
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

  const handleClearSearch = useCallback(() => {
    setSearch('');
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
          {/* Tap-to-dismiss area at top */}
          <Pressable style={styles.dismissArea} onPress={handleClose} />

          {/* Bottom sheet */}
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.card,
                paddingBottom: insets.bottom + 8,
              },
            ]}
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
              <View
                style={[
                  styles.searchInputWrapper,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                  },
                ]}
              >
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search by emoji or category (e.g. 😊, food)"
                  placeholderTextColor={theme.mutedForeground}
                  style={[styles.searchInput, { color: theme.foreground }]}
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <Pressable
                    onPress={handleClearSearch}
                    hitSlop={8}
                    style={styles.clearSearchButton}
                  >
                    <Text
                      style={[
                        styles.clearSearchText,
                        { color: theme.mutedForeground },
                      ]}
                    >
                      ✕
                    </Text>
                  </Pressable>
                )}
              </View>
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
              initialNumToRender={12}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              windowSize={5}
              removeClippedSubviews
              onScrollToIndexFailed={(info) => {
                flatListRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: false,
                });
                setTimeout(() => {
                  if (info.index < sections.length) {
                    flatListRef.current?.scrollToIndex({
                      index: info.index,
                      animated: false,
                    });
                  }
                }, 100);
              }}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />
          </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dismissArea: {
    flex: 1,
    minHeight: 40,
  },
  sheet: {
    flex: 3,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 4,
  },
  clearSearchText: {
    fontSize: 16,
    fontWeight: '600',
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
    height: HEADER_HEIGHT,
    lineHeight: HEADER_HEIGHT,
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
