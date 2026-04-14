import React, { useState, useEffect, useRef } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { MAX_FILES, MAX_FILE_SIZE_MB } from '@/models/constants';
import type { MediaFile } from '@/components/PostCreateMediaUploader';

export default function GalleryScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ existingMedia?: string }>();

  const existingCount = (() => {
    if (!params.existingMedia) return 0;
    try {
      return (JSON.parse(params.existingMedia) as MediaFile[]).length;
    } catch {
      return 0;
    }
  })();

  const [selected, setSelected] = useState<MediaFile[]>([]);
  const remaining = MAX_FILES - existingCount;

  const openPicker = async () => {
    if (remaining <= 0) {
      addToast({ type: 'warning', title: `Maximum ${MAX_FILES} files already attached` });
      router.back();
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: remaining - selected.length,
      quality: 0.8,
    });

    if (result.canceled) {
      if (selected.length === 0) {
        router.back();
      }
      return;
    }

    const rejected: string[] = [];
    const files: MediaFile[] = result.assets
      .filter((asset) => {
        if (
          asset.fileSize &&
          asset.fileSize > MAX_FILE_SIZE_MB * 1024 * 1024
        ) {
          rejected.push(asset.fileName || 'file');
          return false;
        }
        return true;
      })
      .map((asset) => ({
        uri: asset.uri,
        name: asset.fileName || `media-${Date.now()}`,
        type: asset.mimeType || 'image/jpeg',
        size: asset.fileSize,
      }));

    if (rejected.length > 0) {
      addToast({
        type: 'warning',
        title: `${rejected.length} file(s) skipped — over ${MAX_FILE_SIZE_MB}MB`,
      });
    }

    const merged = [...selected, ...files].slice(0, remaining);
    setSelected(merged);
  };

  const hasOpenedRef = useRef(false);
  useEffect(() => {
    if (!hasOpenedRef.current) {
      hasOpenedRef.current = true;
      openPicker();
    }
  });

  const removeFile = (index: number) => {
    setSelected((prev) => prev.filter((_, i) => i !== index));
  };

  const confirmSelection = () => {
    if (selected.length === 0) {
      router.back();
      return;
    }
    router.push({
      pathname: '/(protected)/post/new',
      params: { capturedMedia: JSON.stringify(selected) },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="x" size={24} color={theme.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: theme.foreground }]}>
          Select Media
        </Text>
        <Pressable
          onPress={confirmSelection}
          hitSlop={8}
          style={[
            styles.doneButton,
            { backgroundColor: selected.length > 0 ? theme.primary : theme.muted },
          ]}
        >
          <Text
            style={[
              styles.doneText,
              { color: selected.length > 0 ? theme.primaryForeground : theme.mutedForeground },
            ]}
          >
            Done ({selected.length})
          </Text>
        </Pressable>
      </View>

      {/* Selected preview */}
      {selected.length > 0 ? (
        <FlatList
          data={selected}
          numColumns={3}
          keyExtractor={(_, i) => `sel-${i}`}
          contentContainerStyle={styles.grid}
          renderItem={({ item, index }) => (
            <View style={styles.gridItem}>
              <Image source={{ uri: item.uri }} style={styles.gridImage} />
              <Pressable
                style={styles.removeButton}
                onPress={() => removeFile(index)}
              >
                <Feather name="x" size={14} color="#FFF" />
              </Pressable>
              <View style={styles.indexBadge}>
                <Text style={styles.indexText}>{index + 1}</Text>
              </View>
            </View>
          )}
          ListFooterComponent={
            selected.length < remaining ? (
              <Pressable
                style={[styles.addMoreButton, { borderColor: theme.border }]}
                onPress={openPicker}
              >
                <Feather name="plus" size={24} color={theme.mutedForeground} />
                <Text style={[styles.addMoreText, { color: theme.mutedForeground }]}>
                  Add more
                </Text>
              </Pressable>
            ) : null
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Feather name="image" size={48} color={theme.mutedForeground} />
          <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
            No media selected
          </Text>
          <Pressable
            style={[styles.pickButton, { backgroundColor: theme.primary }]}
            onPress={openPicker}
          >
            <Text style={[styles.pickButtonText, { color: theme.primaryForeground }]}>
              Open Gallery
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  doneText: {
    fontSize: 14,
    fontWeight: '700',
  },
  grid: {
    paddingHorizontal: 2,
    paddingBottom: 40,
  },
  gridItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 2,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  addMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 24,
    marginHorizontal: 2,
    marginTop: 8,
    gap: 6,
  },
  addMoreText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 15,
  },
  pickButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 4,
  },
  pickButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
