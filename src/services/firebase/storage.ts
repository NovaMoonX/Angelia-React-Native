import { getAuth } from '@react-native-firebase/auth';
import { getStorage, ref, putFile, getDownloadURL } from '@react-native-firebase/storage';
import { retryWithBackoff } from '@/utils/retryWithBackoff';

const UPLOAD_RULE_RETRY_DELAYS_MS = [250, 600, 1200];

function isStorageUnauthorizedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('[storage/unauthorized]');
}

export async function uploadPostMedia(
  postId: string,
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  if (!getAuth().currentUser) {
    throw new Error('You need to be signed in before uploading media.');
  }

  const storageRef = ref(getStorage(), `posts/${postId}/${fileName}`);

  // Strip file:// prefix — putFile expects a bare file system path
  const localPath = fileUri.replace(/^file:\/\//, '');

  await retryWithBackoff(
    async () => {
      await putFile(storageRef, localPath, { contentType: mimeType });
    },
    UPLOAD_RULE_RETRY_DELAYS_MS,
    { shouldRetry: isStorageUnauthorizedError },
  );

  return getDownloadURL(storageRef);
}
