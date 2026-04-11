import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// @react-native-firebase initialises from google-services.json / GoogleService-Info.plist
// automatically — no JS-side config object is needed.

export { auth, firestore, storage };
export default firebase;
