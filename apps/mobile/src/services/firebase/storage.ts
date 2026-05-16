import { getAuth } from '@react-native-firebase/auth';
import { getApp } from '@react-native-firebase/app';
import { getStorage, ref, putFile, getDownloadURL, deleteObject } from '@react-native-firebase/storage';
import {
  createUploadTask,
  FileSystemSessionType,
  FileSystemUploadType,
  type UploadProgressData,
} from 'expo-file-system/legacy';
import { retryWithBackoff } from '@/utils/retryWithBackoff';

const UPLOAD_RULE_RETRY_DELAYS_MS = [250, 600, 1200];
const UPLOAD_PROGRESS_MIN_DELTA = 0.02;
const UPLOAD_PROGRESS_MIN_INTERVAL_MS = 250;

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
  mimeType: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const currentUser = getAuth().currentUser;
  if (!currentUser) {
    throw new Error('You need to be signed in before uploading media.');
  }

  const storagePath = `posts/${postId}/${fileName}`;
  const storageRef = ref(getStorage(), storagePath);
  let lastProgress = 0;
  let lastProgressAt = 0;

  const reportProgress = (next: number) => {
    const clamped = Math.max(0, Math.min(1, next));
    const now = Date.now();
    const shouldReport =
      clamped >= 1
      || clamped - lastProgress >= UPLOAD_PROGRESS_MIN_DELTA
      || now - lastProgressAt >= UPLOAD_PROGRESS_MIN_INTERVAL_MS;

    if (!shouldReport) {
      return;
    }

    lastProgress = clamped;
    lastProgressAt = now;
    onProgress?.(clamped);
  };

  // First attempt: native background-capable upload task.
  // This can continue more reliably when the app is backgrounded.
  try {
    const appOptions = getApp().options;
    const bucket = appOptions.storageBucket;
    if (!bucket) {
      throw new Error('Missing Firebase storage bucket configuration.');
    }

    const idToken = await currentUser.getIdToken();
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(storagePath)}`;

    const uploadTask = createUploadTask(
      uploadUrl,
      fileUri,
      {
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': mimeType,
        },
        uploadType: FileSystemUploadType.BINARY_CONTENT,
        sessionType: FileSystemSessionType.BACKGROUND,
      },
      (progressEvent: UploadProgressData) => {
        const expected = progressEvent.totalBytesExpectedToSend;
        if (!expected || expected <= 0) {
          return;
        }
        const fraction = progressEvent.totalBytesSent / expected;
        reportProgress(fraction);
      },
    );

    const response = await uploadTask.uploadAsync();
    if (!response || typeof response.status !== 'number') {
      throw new Error('Background upload returned no response.');
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Background upload failed with status ${response.status}`);
    }

    reportProgress(1);
    return await getDownloadURL(storageRef);
  } catch {
    // Fallback: Firebase native SDK putFile path.
    // Keeps uploads working if the background API path fails for any reason.
  }

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

  reportProgress(1);

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
