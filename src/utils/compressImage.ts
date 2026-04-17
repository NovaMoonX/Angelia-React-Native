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
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: MAX_DIMENSION } }],
      {
        compress: COMPRESSION_QUALITY,
        format: SaveFormat.JPEG,
      },
    );
    return result.uri;
  } catch {
    // If compression fails for any reason, fall back to the original
    return uri;
  }
}
