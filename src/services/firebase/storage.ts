import storage from '@react-native-firebase/storage';

export async function uploadPostMedia(
  postId: string,
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const storageRef = storage().ref(`posts/${postId}/${fileName}`);
  const response = await fetch(fileUri);
  const blob = await response.blob();

  await storageRef.put(blob, { contentType: mimeType });
  return storageRef.getDownloadURL();
}
