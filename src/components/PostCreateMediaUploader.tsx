import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { MAX_FILES, MAX_FILE_SIZE_MB } from '@/models/constants';
import { useTheme } from '@/hooks/useTheme';

export interface MediaFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
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
      const newFiles: MediaFile[] = result.assets
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
        .map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || `media-${Date.now()}`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        }));

      onValueChange([...value, ...newFiles].slice(0, MAX_FILES));
    }
  };

  const removeFile = (index: number) => {
    onValueChange(value.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      {value.length > 0 && (
        <FlashList
          data={value}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, index) => `media-${index}`}
          contentContainerStyle={styles.previewList}
          renderItem={({ item, index }) => (
            <View style={styles.previewContainer}>
              <Image source={{ uri: item.uri }} style={styles.preview} />
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
