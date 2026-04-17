import { getStorage, ref, uploadBytes, getDownloadURL } from '@react-native-firebase/storage';

export async function uploadPostMedia(
  postId: string,
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const storageRef = ref(getStorage(), `posts/${postId}/${fileName}`);
  const response = await fetch(fileUri);
  const blob = await response.blob();

  await uploadBytes(storageRef, blob, { contentType: mimeType });
  return getDownloadURL(storageRef);
}
