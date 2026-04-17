import { getStorage, ref, putFile, getDownloadURL } from '@react-native-firebase/storage';

export async function uploadPostMedia(
  postId: string,
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const storageRef = ref(getStorage(), `posts/${postId}/${fileName}`);

  // Strip file:// prefix — putFile expects a bare file system path
  const localPath = fileUri.replace(/^file:\/\//, '');

  await putFile(storageRef, localPath, { contentType: mimeType });

  return getDownloadURL(storageRef);
}
