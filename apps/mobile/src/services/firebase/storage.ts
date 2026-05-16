import { getAuth } from '@react-native-firebase/auth';
import { getStorage, ref, putFile, getDownloadURL, deleteObject } from '@react-native-firebase/storage';
import { retryWithBackoff } from '@/utils/retryWithBackoff';

const UPLOAD_RULE_RETRY_DELAYS_MS = [250, 600, 1200];

function isStorageUnauthorizedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('[storage/unauthorized]');
}

function isStorageObjectNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('[storage/object-not-found]');
}

function getStoragePathFromDownloadUrl(downloadUrl: string): string {
  if (downloadUrl.startsWith('gs://')) {
    const withoutScheme = downloadUrl.replace(/^gs:\/\//, '');
    const firstSlash = withoutScheme.indexOf('/');
    if (firstSlash >= 0) {
      return withoutScheme.slice(firstSlash + 1);
    }
  }

  const parsed = new URL(downloadUrl);
  const objectSegment = '/o/';
  const objectIndex = parsed.pathname.indexOf(objectSegment);
  if (objectIndex < 0) {
    throw new Error('Invalid Firebase Storage URL');
  }

  const encodedPath = parsed.pathname.slice(objectIndex + objectSegment.length);
  if (!encodedPath) {
    throw new Error('Missing Firebase Storage object path');
  }

  return decodeURIComponent(encodedPath);
}

export async function uploadPostMedia(
  postId: string,
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const currentUser = getAuth().currentUser;
  if (!currentUser) {
    throw new Error('You need to be signed in before uploading media.');
  }

  const storagePath = `posts/${postId}/${fileName}`;
  const storageRef = ref(getStorage(), storagePath);

  // Strip file:// prefix — putFile expects a bare file system path
  const localPath = fileUri.replace(/^file:\/\//, '');

  try {
    await retryWithBackoff(
      async () => {
        await putFile(storageRef, localPath, { contentType: mimeType });
      },
      UPLOAD_RULE_RETRY_DELAYS_MS,
      { shouldRetry: isStorageUnauthorizedError },
    );
  } catch (error) {
    throw error;
  }

  const downloadUrl = await getDownloadURL(storageRef);

  return downloadUrl;
}

/**
 * Uploads a local image file as the current user's profile avatar.
 * Stored at `avatars/{userId}/avatar.jpg` in Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadUserAvatar(userId: string, fileUri: string): Promise<string> {
  if (!getAuth().currentUser) {
    throw new Error('You need to be signed in before uploading an avatar.');
  }

  const storageRef = ref(getStorage(), `avatars/${userId}/avatar.jpg`);

  // Strip file:// prefix — putFile expects a bare file system path
  const localPath = fileUri.replace(/^file:\/\//, '');

  await retryWithBackoff(
    async () => {
      await putFile(storageRef, localPath, { contentType: 'image/jpeg' });
    },
    UPLOAD_RULE_RETRY_DELAYS_MS,
    { shouldRetry: isStorageUnauthorizedError },
  );

  return getDownloadURL(storageRef);
}

export async function deletePostMediaByUrl(downloadUrl: string): Promise<void> {
  const currentUser = getAuth().currentUser;
  if (!currentUser) {
    throw new Error('You need to be signed in before removing media.');
  }

  const storagePath = getStoragePathFromDownloadUrl(downloadUrl);
  const storageRef = ref(getStorage(), storagePath);

  try {
    await retryWithBackoff(
      async () => {
        await deleteObject(storageRef);
      },
      UPLOAD_RULE_RETRY_DELAYS_MS,
      { shouldRetry: isStorageUnauthorizedError },
    );
  } catch (error) {
    if (isStorageObjectNotFoundError(error)) {
      return;
    }
    throw error;
  }
}
