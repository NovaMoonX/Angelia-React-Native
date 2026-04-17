import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MAX_DIMENSION = 1920;
const COMPRESSION_QUALITY = 0.75;

/**
 * Compresses a local image URI, capping the longest dimension at MAX_DIMENSION
 * and applying JPEG compression. Videos and already-processed files are passed
 * through unchanged.
 */
export async function compressImage(
  uri: string,
  mimeType: string,
): Promise<string> {
  if (!mimeType.startsWith('image/')) return uri;

  try {
    // Fetch the image dimensions first to determine which axis to constrain
    const { width, height } = await getImageDimensions(uri);
    const longest = Math.max(width, height);

    if (longest <= MAX_DIMENSION) {
      // Image is already within bounds; just apply compression
      const result = await manipulateAsync(uri, [], {
        compress: COMPRESSION_QUALITY,
        format: SaveFormat.JPEG,
      });
      return result.uri;
    }

    // Constrain the longest side; expo-image-manipulator preserves aspect ratio
    // when only one dimension is provided.
    const resize =
      width >= height
        ? { width: MAX_DIMENSION }
        : { height: MAX_DIMENSION };

    const result = await manipulateAsync(uri, [{ resize }], {
      compress: COMPRESSION_QUALITY,
      format: SaveFormat.JPEG,
    });
    return result.uri;
  } catch {
    // If compression fails for any reason, fall back to the original
    return uri;
  }
}

function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    // React Native's Image.getSize is the standard way to fetch dimensions
    // without loading the full bitmap into JS memory.
    const { Image } = require('react-native') as typeof import('react-native');
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 0, height: 0 }), // fallback; compressImage will skip resize
    );
  });
}
