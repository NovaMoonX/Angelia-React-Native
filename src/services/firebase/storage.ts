import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './config';

export async function uploadPostMedia(
  postId: string,
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const storageRef = ref(storage, `posts/${postId}/${fileName}`);
  const response = await fetch(fileUri);
  const blob = await response.blob();

  const uploadTask = uploadBytesResumable(storageRef, blob, {
    contentType: mimeType,
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      null,
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      }
    );
  });
}
