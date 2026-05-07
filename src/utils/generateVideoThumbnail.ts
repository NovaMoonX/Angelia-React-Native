import { createVideoPlayer } from 'expo-video';
import type { VideoThumbnail } from 'expo-video';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Waits for the player to reach 'readyToPlay' before proceeding.
 * On iOS, generateThumbnailsAsync requires currentItem to be loaded — calling
 * it immediately after createVideoPlayer returns [] because the asset is not
 * yet attached to the player. This races to the first readyToPlay status event.
 */
function waitForPlayerReady(player: ReturnType<typeof createVideoPlayer>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (player.status === 'readyToPlay') {
      resolve();
      return;
    }
    if (player.status === 'error') {
      reject(new Error('VideoPlayer error'));
      return;
    }
    const sub = player.addListener('statusChange', (payload) => {
      if (payload.status === 'readyToPlay') {
        sub.remove();
        resolve();
      } else if (payload.status === 'error') {
        sub.remove();
        reject(new Error('VideoPlayer error'));
      }
    });
  });
}

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
    await waitForPlayerReady(player);
    const thumbnails = await player.generateThumbnailsAsync(0, { maxWidth: 400 });
    return thumbnails[0] ?? null;
  } catch {
    return null;
  } finally {
    // Release the player so it doesn't leak native resources
    player.release();
  }
}

/**
 * Generates a thumbnail for a local video URI at t=0 and saves it as a JPEG
 * in the device cache. Returns a `file://` URI suitable for uploading to
 * Firebase Storage, or null if generation fails.
 */
export async function generateVideoThumbnailFileUri(
  uri: string,
): Promise<string | null> {
  if (!uri) return null;
  const player = createVideoPlayer(uri);
  try {
    await waitForPlayerReady(player);
    const thumbnails = await player.generateThumbnailsAsync(0, { maxWidth: 640 });
    const thumbnail = thumbnails[0];
    if (!thumbnail) return null;

    const ctx = ImageManipulator.manipulate(thumbnail);
    const imageRef = await ctx.renderAsync();
    const result = await imageRef.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
    return result.uri;
  } catch {
    return null;
  } finally {
    player.release();
  }
}
