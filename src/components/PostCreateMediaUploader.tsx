import React from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { MAX_FILES, MAX_FILE_SIZE_MB } from '@/models/constants';
import { generateVideoThumbnailFileUri } from '@/utils/generateVideoThumbnail';
import { useTheme } from '@/hooks/useTheme';

export interface MediaFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
  /** For videos: local `file://` URI of the generated thumbnail image. */
  thumbnailUri?: string;
}

interface PostCreateMediaUploaderProps {
  value: MediaFile[];
  onValueChange: (files: MediaFile[]) => void;
}

export function PostCreateMediaUploader({
  value,
  onValueChange,
}: PostCreateMediaUploaderProps) {
  const { theme } = useTheme();

  const pickMedia = async () => {
    if (value.length >= MAX_FILES) {
      Alert.alert('Limit Reached', `Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_FILES - value.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
    const newFiles: MediaFile[] = await Promise.all(
        result.assets
          .filter((asset) => {
            if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_MB * 1024 * 1024) {
              Alert.alert(
                'File Too Large',
                `${asset.fileName || 'File'} exceeds ${MAX_FILE_SIZE_MB}MB limit`
              );
              return false;
            }
            return true;
          })
          .map(async (asset) => {
            const file: MediaFile = {
              uri: asset.uri,
              name: asset.fileName || `media-${Date.now()}`,
              type: asset.mimeType || 'image/jpeg',
              size: asset.fileSize,
            };
            if (asset.mimeType?.startsWith('video/')) {
              file.thumbnailUri = (await generateVideoThumbnailFileUri(asset.uri)) ?? undefined;
            }
            return file;
          })
      );

      onValueChange([...value, ...newFiles].slice(0, MAX_FILES));
    }
  };

  const removeFile = (index: number) => {
    onValueChange(value.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      {value.length > 0 && (
        <FlatList
          data={value}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, index) => `media-${index}`}
          contentContainerStyle={styles.previewList}
          renderItem={({ item, index }) => (
            <View style={styles.previewContainer}>
              {item.type.startsWith('video/') ? (
                <View style={[styles.preview, styles.videoPreview]}>
                  {item.thumbnailUri ? (
                    <Image source={{ uri: item.thumbnailUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : null}
                  <View style={styles.videoOverlay}>
                    <Feather name="play-circle" size={28} color="#FFF" />
                  </View>
                </View>
              ) : (
                <Image source={{ uri: item.uri }} style={styles.preview} contentFit="cover" />
              )}
              <Pressable
                style={styles.removeButton}
                onPress={() => removeFile(index)}
              >
                <Feather name="x" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
        />
      )}
      {value.length < MAX_FILES && (
        <Button variant="outline" onPress={pickMedia}>
          <View style={styles.uploadRow}>
            <Feather name="image" size={16} color={theme.foreground} />
            <Text style={{ color: theme.foreground, marginLeft: 6 }}>
              Add Media ({value.length}/{MAX_FILES})
            </Text>
          </View>
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  previewList: {
    gap: 8,
  },
  previewContainer: {
    position: 'relative',
    overflow: 'visible',
    marginTop: 8,
  },
  preview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  videoPreview: {
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
