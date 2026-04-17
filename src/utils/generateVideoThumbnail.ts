import { createVideoPlayer } from 'expo-video';
import type { VideoThumbnail } from 'expo-video';

/**
 * Generates a thumbnail for a local or remote video URI at t=0 using expo-video's
 * VideoPlayer.generateThumbnailsAsync. Returns a VideoThumbnail SharedRef (usable
 * as an expo-image source), or null if generation fails.
 */
export async function generateVideoThumbnail(
  uri: string,
): Promise<VideoThumbnail | null> {
  if (!uri) return null;
  const player = createVideoPlayer(uri);
  try {
    const thumbnails = await player.generateThumbnailsAsync(0, { maxWidth: 400 });
    return thumbnails[0] ?? null;
  } catch {
    return null;
  } finally {
    // Release the player so it doesn't leak native resources
    player.release();
  }
}
